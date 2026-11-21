import { expect, test } from "vitest";
import { getEditionReview } from "@/lib/ingest/edition-review";

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

test("accepts the same stated phrase after normalizing whitespace", () => {
  expect(getEditionReview(statedEdition, "รายการทดสอบ · ฉบับ\n  มังงะ · เล่ม 12")).toBeNull();
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
