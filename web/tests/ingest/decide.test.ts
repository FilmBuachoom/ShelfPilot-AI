import { expect, test } from "vitest";
import { decideMatchStatus } from "@/lib/ingest/decide";
import { normalizeItem } from "@/lib/ingest/normalize";
import { book } from "../shelf-fixture";
import { input, item, matchResult } from "./fixtures";

const extracted = normalizeItem(item, input.raw_text);
const candidate = book("bk_target", 13);

test("same series, volume and edition merges", () => {
  expect(decideMatchStatus(extracted, matchResult, candidate)).toBe("duplicate_merged");
});

test("a different stated edition of the same series and volume creates a row", () => {
  expect(decideMatchStatus(extracted, matchResult, { ...candidate, edition: "light_novel" })).toBe("distinct_edition");
});

test("no plausible candidate creates a row", () => {
  expect(decideMatchStatus(extracted, null, undefined)).toBe("distinct_edition");
  expect(decideMatchStatus(extracted, {
    ...matchResult, candidate_book_id: null, same_series: false, same_volume: false,
  }, undefined)).toBe("distinct_edition");
});

test("missing edition, mismatched volume, and ambiguous or invalid candidate require review", () => {
  expect(decideMatchStatus({ ...extracted, edition: null }, matchResult, candidate)).toBe("needs_review");
  expect(decideMatchStatus(extracted, matchResult, { ...candidate, volume: 12 })).toBe("needs_review");
  expect(decideMatchStatus(extracted, { ...matchResult, same_series: false }, candidate)).toBe("needs_review");
  expect(decideMatchStatus(extracted, { ...matchResult, same_volume: false }, candidate)).toBe("needs_review");
  expect(decideMatchStatus(extracted, { ...matchResult, edition: "light_novel" }, candidate)).toBe("needs_review");
  expect(decideMatchStatus(extracted, {
    ...matchResult, candidate_book_id: null, same_series: false, same_volume: false, rejectedCandidate: true,
  }, undefined)).toBe("needs_review");
});
