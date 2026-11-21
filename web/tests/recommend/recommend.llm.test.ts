import { expect, test } from "vitest";
import { readCatalog, readShelf } from "@/lib/data/store";
import { getRecommendations } from "@/lib/recommend/run";

test.skipIf(process.env.RUN_RECOMMEND_LLM_TEST !== "1")(
  "cites known announcements for recommendations with the authorized catalog",
  async () => {
    const [catalog, shelf] = await Promise.all([readCatalog(), readShelf()]);
    expect(catalog.sources.length).toBeGreaterThan(0);
    expect(shelf.owned.length).toBeGreaterThan(0);

    const result = await getRecommendations(catalog, shelf, true);
    expect(result.fallback).toBe(false);
    expect(result.continue.some(({ reason }) => Boolean(reason))).toBe(true);
    for (const item of [...result.continue, ...result.similar]) {
      const book = catalog.books.find(({ book_id }) => book_id === item.book_id);
      expect(book).toBeDefined();
      if (item.reason) expect(item.source_ids.length).toBeGreaterThan(0);
      for (const source_id of item.source_ids) {
        expect(book?.sources).toContain(source_id);
        expect(catalog.sources.some((source) => source.source_id === source_id)).toBe(true);
      }
    }
  },
  30_000,
);
