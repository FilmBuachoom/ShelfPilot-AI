import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";
import { readCatalog } from "@/lib/data/store";
import { matchTitle } from "@/lib/ingest/match";
import { runPipeline } from "@/lib/ingest/pipeline";
import type { IngestInput } from "@/lib/ingest/contracts";
import type { BookId, Catalog } from "@/types/generated";

interface AuthorizedFixture {
  catalog: Catalog;
  book_id: BookId;
  announcements: [IngestInput, IngestInput];
  queries: [string, string, string];
}

const fixturePath = process.env.SHELFPILOT_MATCH_FIXTURE ?? "";

test.skipIf(!fixturePath)("matches authorized title variants and merges two publisher announcements", async () => {
  const fixture: AuthorizedFixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const beforeBook = fixture.catalog.books.find(({ book_id }) => book_id === fixture.book_id);
  if (!beforeBook) throw new Error("The authorized fixture must contain its expected book ID");

  const dir = await mkdtemp(path.join(os.tmpdir(), "ingest-llm-"));
  vi.stubEnv("SHELFPILOT_DATA_DIR", dir);
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "json");
  try {
    await Promise.all([
      writeFile(path.join(dir, "catalog.json"), JSON.stringify(fixture.catalog)),
      writeFile(path.join(dir, "review_queue.json"), JSON.stringify({ items: [] })),
    ]);
    for (const query of fixture.queries) {
      const result = await matchTitle(query);
      const candidate = fixture.catalog.books.find(({ book_id }) => book_id === result?.candidate_book_id);
      expect(result?.same_series).toBe(true);
      expect(candidate?.series_id).toBe(beforeBook.series_id);
    }
    for (const announcement of fixture.announcements) {
      const result = await runPipeline(announcement);
      expect(result.decisions).toMatchObject([{
        match_status: "duplicate_merged", candidate_book_id: fixture.book_id,
      }]);
    }

    const after = await readCatalog();
    const afterBook = after.books.find(({ book_id }) => book_id === fixture.book_id);
    expect(after.books).toHaveLength(fixture.catalog.books.length);
    expect(after.sources).toHaveLength(fixture.catalog.sources.length + 2);
    expect(afterBook?.sources).toHaveLength(beforeBook.sources.length + 2);
    expect(afterBook?.sale_status).toBe("released");
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
}, 180_000);
