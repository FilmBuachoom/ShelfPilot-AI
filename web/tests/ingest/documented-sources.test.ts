// Offline replay of curated repository metadata. All model calls are mocked and writes go to a temp directory.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readCatalog, readReviewQueue } from "@/lib/data/store";
import type { ExtractedItem, IngestInput } from "@/lib/ingest/contracts";
import { matchTitle } from "@/lib/ingest/match";
import { runPipeline } from "@/lib/ingest/pipeline";
import { resolveReview } from "@/lib/ingest/resolve-review";
import { callStructured } from "@/lib/llm/client";
import type { Book, Catalog } from "@/types/generated";
import fixture from "../../../fixtures/demo/database/catalog.json";
import { matchResult } from "./fixtures";

vi.mock("@/lib/llm/client", async (original) => ({
  ...await original<typeof import("@/lib/llm/client")>(), callStructured: vi.fn(),
}));

const catalog = fixture as Catalog;
const regular = requireBook("book-phoenix-cdf9b96a8eb5-light_novel-16");

function requireBook(bookId: string): Book {
  const book = catalog.books.find(({ book_id }) => book_id === bookId);
  if (!book) throw new Error(`Missing demo book: ${bookId}`);
  return book;
}

function phoenixExcerpt(sourceId: string): IngestInput {
  const source = catalog.sources.find(({ source_id }) => source_id === sourceId);
  const heading = source?.raw_text.split("\n")[0];
  const line = source?.raw_text.split("\n").find((text) => text.startsWith(regular.title));
  if (!source || !heading || !line) throw new Error(`Missing Phoenix fixture excerpt: ${sourceId}`);
  return { raw_text: [heading, line].join("\n"), source_url: source.source_url, publisher_hint: source.publisher };
}

let dir: string;
let catalogFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "shelfpilot-doc-source-qa-"));
  catalogFile = path.join(dir, "catalog.json");
  await writeFile(path.join(dir, "review_queue.json"), JSON.stringify({ items: [] }));
  vi.stubEnv("SHELFPILOT_DATA_DIR", dir);
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "json");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  await rm(dir, { recursive: true, force: true });
});

function reply(data: unknown) {
  return { data, message: { role: "assistant" as const, content: null, refusal: null } };
}

function stubImport(edition: ExtractedItem["edition"], quote: string | null, precision: "month" | "unknown" = "unknown") {
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{
      title: regular.title, publisher: regular.publisher, volume: regular.volume,
      edition, edition_evidence: quote, edition_confidence: edition ? 0.95 : null,
      release_date: null, release_date_precision: precision, sale_status: null,
    }] }))
    .mockResolvedValueOnce(reply({
      ...matchResult, candidate_book_id: regular.book_id, edition, edition_confidence: edition ? 0.95 : 0,
    }));
}

async function seedRegular() {
  // Remove preloaded sources so the fixture actually exercises deduplication on different URLs.
  await writeFile(catalogFile, JSON.stringify({
    books: [{ ...regular, sources: [] }], sources: [], updated_at: catalog.updated_at,
  }));
}

test("QA-11-1: Phoenix announcement and regular listing append two sources to one book", async () => {
  await seedRegular();
  const inputs = [phoenixExcerpt("demo-phoenix-sep"), phoenixExcerpt("demo-phoenix-standard")];
  const addedSources: string[] = [];
  for (const [index, input] of inputs.entries()) {
    stubImport("light_novel", "ไลต์โนเวล", index === 0 ? "month" : "unknown");
    const result = await runPipeline(input);
    expect(result.decisions).toMatchObject([{
      match_status: "duplicate_merged", candidate_book_id: regular.book_id,
    }]);
    addedSources.push(result.source.source_id);
  }

  const after = await readCatalog();
  expect(after.books).toHaveLength(1);
  expect(after.books[0].sources).toEqual(addedSources);
  expect(after.sources.map(({ source_url }) => source_url)).toEqual(inputs.map(({ source_url }) => source_url));
  expect(await runPipeline(inputs[1])).toMatchObject({ status: "already_imported" });
  expect(callStructured).toHaveBeenCalledTimes(4);
  expect((await readCatalog()).books[0].sources).toEqual(addedSources);
});

test("QA-11-2: Thai, Japanese, English and short names reach the same Phoenix series", async () => {
  await writeFile(catalogFile, JSON.stringify(catalog));
  const queries = [regular.title, "薬屋のひとりごと", "The Apothecary Diaries", "หมอยาฯ"];
  expect(regular.aliases).toEqual(queries.slice(1, 3));
  vi.mocked(callStructured).mockImplementation(async ({ messages }) => {
    const userMessage = messages.at(-1)?.content;
    if (typeof userMessage !== "string") throw new Error("Expected a matcher payload");
    const { candidates, title } = JSON.parse(userMessage) as { candidates: Book[]; title: string };
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(candidates.some(({ book_id }) => book_id === regular.book_id)).toBe(true);
    return reply({
      ...matchResult,
      edition: regular.edition,
      candidate_book_id: regular.book_id,
      matched_alias: regular.aliases.find((alias) => alias === title) ?? null,
    });
  });

  for (const query of queries) {
    const match = await matchTitle(query);
    expect(match?.candidate_book_id).toBe(regular.book_id);
    expect(match?.rejectedCandidate).toBeUndefined();
  }
  expect(callStructured).toHaveBeenCalledTimes(4);
});

test("QA-12-1: an explicit special set stays distinct and missing edition requires approval", async () => {
  await seedRegular();
  stubImport("special_set", "ชุดพิเศษ (ไลต์โนเวล)");
  expect((await runPipeline(phoenixExcerpt("demo-phoenix-special"))).decisions).toMatchObject([
    { match_status: "distinct_edition" },
  ]);
  const afterSpecial = await readCatalog();
  expect(afterSpecial.books).toHaveLength(2);
  const special = afterSpecial.books.find(({ edition }) => edition === "special_set");
  expect(special).toMatchObject({ series_id: regular.series_id, volume: regular.volume });
  expect(special?.book_id).not.toBe(regular.book_id);

  // Negative control derived from the metadata. This URL and input are QA-only.
  const ambiguous = { raw_text: `${regular.title} · เล่ม ${regular.volume}`, source_url: "https://example.test/qa/phoenix-edition-omitted" };
  const bytesBeforeReview = await readFile(catalogFile, "utf8");
  stubImport(null, null);
  expect((await runPipeline(ambiguous)).decisions).toMatchObject([{ match_status: "needs_review" }]);
  const { items: [review] } = await readReviewQueue();
  expect(review).toMatchObject({ status: "open", extracted: { source: { source_url: ambiguous.source_url } } });
  expect(review.candidates.map(({ edition }) => edition).sort()).toEqual(["light_novel", "special_set"]);
  expect(await readFile(catalogFile, "utf8")).toBe(bytesBeforeReview);

  await resolveReview({ review_id: review.review_id, action: "merge", book_id: regular.book_id });
  expect((await readReviewQueue()).items).toMatchObject([{ status: "resolved" }]);
  const afterApproval = await readCatalog();
  expect(afterApproval.books.filter(({ sources }) => sources.includes(review.source_id)).map(({ book_id }) => book_id))
    .toEqual([regular.book_id]);
  expect(afterApproval.books).toHaveLength(2);
});
