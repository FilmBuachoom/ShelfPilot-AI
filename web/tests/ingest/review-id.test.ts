import { expect, test } from "vitest";
import { createReviewId } from "@/lib/ingest/review-id";

test("a repeated import yields the same review ID for the same source row", () => {
  const id = createReviewId("demo-luckpim-oct", 0);
  expect(id).toMatch(/^rv_[0-9a-f]{12}$/);
  expect(createReviewId("demo-luckpim-oct", 0)).toBe(id);
});

test("different rows or sources do not share a review ID", () => {
  const ids = [createReviewId("src_first", 0), createReviewId("src_first", 1), createReviewId("src_other", 0)];
  expect(new Set(ids).size).toBe(ids.length);
});

test.each([-1, 0.5, Number.NaN])("rejects an invalid row index (%s)", (index) => {
  expect(() => createReviewId("src_first", index)).toThrow(RangeError);
});
