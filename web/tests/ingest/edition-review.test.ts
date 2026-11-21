import { expect, test } from "vitest";
import { getEditionReview, getItemEditionReview } from "@/lib/ingest/edition-review";
import { normalizeItem } from "@/lib/ingest/normalize";
import { item } from "./fixtures";

const source = "รายการทดสอบ · ฉบับ มังงะ · เล่ม 12";
const statedEdition = { edition: "manga" as const, edition_evidence: "ฉบับ มังงะ", edition_confidence: 0.95 };

test.each([
  { edition: null },
  { edition_evidence: null },
  { edition_evidence: " \n " },
  { edition_evidence: "ไลต์โนเวล" },
])("requires verbatim edition evidence even with high confidence (%j)", (override) => {
  expect(getEditionReview({ ...statedEdition, ...override }, source)).toEqual({
    status: "needs_review", reason: "ประกาศไม่ระบุฉบับ",
  });
});

test("checks evidence before the threshold and reports the first reason", () => {
  expect(getEditionReview({ ...statedEdition, edition_confidence: 0.2 }, "รายการทดสอบ · เล่ม 12")).toEqual({
    status: "needs_review", reason: "ประกาศไม่ระบุฉบับ",
  });
});

test("preserves a whitespace-normalized quote from extraction through edition review", () => {
  const rawText = "รายการทดสอบ · ฉบับ\n  มังงะ · เล่ม 12";
  const extracted = normalizeItem({ ...item, ...statedEdition }, rawText);
  expect(extracted).toMatchObject(statedEdition);
  expect(getEditionReview(extracted, rawText)).toBeNull();
});

test.each(["ฉบับนิยาย", "เล่ม 12", "มังงะและไลต์โนเวล", "ไม่ใช่มังงะ"])(
  "rejects a verbatim quote that does not affirm the claimed edition (%s)", (edition_evidence) => {
    expect(getEditionReview({ ...statedEdition, edition_evidence }, `รายการทดสอบ · ${edition_evidence}`))
      .toEqual({ status: "needs_review", reason: "หลักฐานไม่ยืนยันฉบับที่ระบุ" });
  },
);

test.each([
  ["รายการทดสอบ · ไม่ใช่มังงะ", "มังงะ"],
  ["รายการทดสอบ · ไม่ใช่ฉบับมังงะ", "มังงะ"],
  ["Test item · not a manga", "manga"],
  ["Test item · non-manga", "manga"],
])("rejects an edition quote shortened from a negated source phrase (%s)", (rawText, edition_evidence) => {
  expect(getEditionReview({ ...statedEdition, edition_evidence }, rawText))
    .toEqual({ status: "needs_review", reason: "หลักฐานไม่ยืนยันฉบับที่ระบุ" });
});

test("looks for a positive occurrence if an earlier mention was negated", () => {
  const rawText = "รายการทดสอบ · ไม่ใช่มังงะปกแข็ง · ฉบับมังงะ · เล่ม 12";
  expect(getEditionReview({ ...statedEdition, edition_evidence: "มังงะ" }, rawText)).toBeNull();
});

test.each(["Life of a mangaka", "My manga story"])("a title containing manga is not edition evidence (%s)", (title) => {
  const signals = { ...statedEdition, title, edition_evidence: "manga" };
  expect(getEditionReview(signals, `${title} · Vol. 13`)).toMatchObject({ status: "needs_review" });
  expect(getEditionReview(signals, `${title} · manga · Vol. 13`)).toBeNull();
});

test("keeps evidence with the right volume when a title appears twice", () => {
  const rawText = "fixture-a · มังงะ · เล่ม ๑๓\nfixture-a · ไลต์โนเวล · Vol. 14";
  const first = normalizeItem(item, rawText);
  const second = normalizeItem({ ...item, volume: 14, edition: "light_novel", edition_evidence: "ไลต์โนเวล" }, rawText);
  expect(getItemEditionReview(first, [first, second], rawText)).toBeNull();
  expect(getItemEditionReview(second, [first, second], rawText)).toBeNull();

  const wrong = { ...second, edition: first.edition, edition_evidence: first.edition_evidence };
  expect(getItemEditionReview(wrong, [first, wrong], rawText)).toMatchObject({ status: "needs_review" });
});

test.each([
  ["manga", "ฉบับ: มังงะ"],
  ["light_novel", "Light novel edition"],
  ["special_set", "บ็อกซ์เซ็ต"],
  ["big_book", "Big Book"],
] as const)("accepts the explicit label for %s (%s)", (edition, edition_evidence) => {
  expect(getEditionReview({ ...statedEdition, edition, edition_evidence }, `รายการทดสอบ · ${edition_evidence}`))
    .toBeNull();
});

test("accepts an explicit special set with a parenthetical base format", () => {
  const edition_evidence = "ชุดพิเศษ (ไลต์โนเวล)";
  const rawText = `รายการทดสอบ · ${edition_evidence} · เล่ม 12`;
  expect(getEditionReview({ ...statedEdition, edition: "special_set", edition_evidence }, rawText)).toBeNull();
  expect(getEditionReview({ ...statedEdition, edition: "light_novel", edition_evidence }, rawText))
    .toMatchObject({ status: "needs_review" });
  expect(getEditionReview({ ...statedEdition, edition: "light_novel", edition_evidence: "ไลต์โนเวล" }, rawText))
    .toMatchObject({ status: "needs_review" });
});

test("requires evidence on the right source row even when the model only extracted one volume", () => {
  const rawText = "fixture-a · มังงะ · เล่ม ๑๒\nfixture-a · เล่ม ๑๓";
  const only = normalizeItem(item, rawText);
  expect(getItemEditionReview(only, [only], rawText)).toMatchObject({ status: "needs_review" });
  expect(getItemEditionReview(only, [only], `${rawText} · มังงะ`)).toBeNull();
  expect(getItemEditionReview(only, [only], rawText.replace("\n", " / ")))
    .toMatchObject({ status: "needs_review" });
  expect(getItemEditionReview(only, [only], "fixture-a · มังงะ · 12\nfixture-a · 13"))
    .toMatchObject({ status: "needs_review" });
});

test("routes a score of 0.79 to human review with a reason", () => {
  expect(getEditionReview({ ...statedEdition, edition_confidence: 0.79 }, source)).toEqual({
    status: "needs_review", reason: "ความมั่นใจ 0.79 < 0.8",
  });
});

test.each([0.8, 1])("lets a stated edition with confidence %s reach the matcher", (confidence) => {
  expect(getEditionReview({ ...statedEdition, edition_confidence: confidence }, source)).toBeNull();
});

test.each([null, Number.NaN, Infinity, 1.01, -0.01])("never passes a missing or invalid score (%s)", (confidence) => {
  expect(getEditionReview({ ...statedEdition, edition_confidence: confidence }, source))
    .toMatchObject({ status: "needs_review" });
});
