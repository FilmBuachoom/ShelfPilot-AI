import { expect, test } from "vitest";
import { applyMatches } from "@/lib/ingest/apply";
import { normalizeItem } from "@/lib/ingest/normalize";
import type { IngestContext } from "@/lib/ingest/contracts";
import { book, catalog, timestamp } from "../shelf-fixture";
import { input, item, matchResult } from "./fixtures";

const original = book("bk_target", 13, {
  sources: ["src_preorder"], sale_status: "preorder",
  release_date: "2026-10-01", release_date_precision: "month",
});
const context: IngestContext = {
  source: { ...input, source_id: "src_released", publisher: original.publisher, imported_at: timestamp },
  extraction: { items: [normalizeItem({ ...item, title: "ชุดฯ", sale_status: "released" }, input.raw_text)] },
};

test("duplicates append a source, learn an alias and take the more precise date and later status", () => {
  const before = catalog(original);
  const { catalog: after, decisions } = applyMatches(before, context, [matchResult]);
  expect(after.books).toHaveLength(1);
  expect(after.books[0]).toMatchObject({
    book_id: original.book_id, sources: ["src_preorder", "src_released"],
    aliases: [...original.aliases, "ชุดฯ"], sale_status: "released",
    release_date: "2026-10-02", release_date_precision: "day",
  });
  expect(before.books[0]).toEqual(original);
  expect(after.sources).toEqual([context.source]);
  expect(decisions[0]).toMatchObject({ match_status: "duplicate_merged", candidate_book_id: original.book_id });
  expect(applyMatches(after, context, [matchResult]).catalog).toBe(after);
});

test("an earlier announcement cannot regress sale status or erase a known day", () => {
  const before = catalog({ ...original, sale_status: "released", release_date: "2026-10-03", release_date_precision: "day" });
  const earlier = { ...context, extraction: { items: [{
    ...context.extraction.items[0], sale_status: "announced" as const, release_date: null, release_date_precision: "month" as const,
  }] } };
  expect(applyMatches(before, earlier, [matchResult]).catalog.books[0]).toMatchObject({
    sale_status: "released", release_date: "2026-10-03", release_date_precision: "day",
  });
});

test("a distinct edition gets its own stable ID in the matched series", () => {
  const before = catalog({ ...original, edition: "light_novel" });
  const { catalog: after, decisions } = applyMatches(before, context, [matchResult]);
  expect(decisions[0].match_status).toBe("distinct_edition");
  const added = after.books[1];
  expect(added).toMatchObject({ edition: "manga", series_id: original.series_id, sources: ["src_released"] });
  expect(added.book_id).toMatch(/^bk_[0-9a-f]{12}$/);
  expect(added.book_id).not.toBe(original.book_id);
  expect(applyMatches(before, context, [matchResult]).catalog.books[1].book_id).toBe(added.book_id);
});

test("a review-only import leaves the catalog untouched", () => {
  const before = catalog(original);
  const ambiguous = { ...context, extraction: { items: [{ ...context.extraction.items[0], edition: null }] } };
  const result = applyMatches(before, ambiguous, [matchResult]);
  expect(result.catalog).toBe(before);
  expect(result.decisions[0].match_status).toBe("needs_review");
});
