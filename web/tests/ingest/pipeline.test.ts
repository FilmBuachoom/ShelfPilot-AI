import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { readCatalog } from "@/lib/data/store";
import { createSourceId } from "@/lib/ingest/source-id";
import { callStructured, LlmUnavailableError } from "@/lib/llm/client";
import { book, catalog } from "../shelf-fixture";
import { input, item, matchResult } from "./fixtures";

vi.mock("@/lib/llm/client", async (original) => ({
  ...await original<typeof import("@/lib/llm/client")>(), callStructured: vi.fn(),
}));

const original = book("bk_target", 13, { aliases: ["テスト", "Tesuto", "ชุดฯ"], sale_status: "announced" });
let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "ingest-test-"));
  file = path.join(dir, "catalog.json");
  await writeFile(file, JSON.stringify(catalog(original)));
  vi.stubEnv("SHELFPILOT_DATA_DIR", dir);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const secondInput = { ...input, raw_text: "fixture-b · มังงะ · เล่ม ๑๓", source_url: "https://example.test/source-b" };

function ingest(body = input) {
  return POST(new Request("http://localhost:3000/api/ingest", {
    method: "POST",
    headers: { Host: "127.0.0.1:3000", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

function reply(data: unknown) {
  return { data, message: { role: "assistant" as const, content: null, refusal: null } };
}

test("imports pre-order and release posts under different titles into one book", async () => {
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, sale_status: "preorder" }] }))
    .mockResolvedValueOnce(reply(matchResult))
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: "テスト", sale_status: "released" }] }))
    .mockResolvedValueOnce(reply({ ...matchResult, matched_alias: "テスト" }));

  const preorder = await ingest();
  expect(preorder.status).toBe(200);
  expect((await readCatalog()).books[0].sale_status).toBe("preorder");

  const released = await ingest(secondInput);
  expect(released.status).toBe(200);
  expect(await released.json()).toMatchObject({
    status: "imported",
    decisions: [{
      match_status: "duplicate_merged", candidate_book_id: original.book_id, matched_alias: "テスト",
    }],
  });
  const stored = await readCatalog();
  expect(stored.books).toHaveLength(1);
  expect(stored.books[0]).toMatchObject({
    book_id: original.book_id,
    sale_status: "released",
    sources: [createSourceId(input.raw_text, input.source_url), createSourceId(secondInput.raw_text, secondInput.source_url)],
  });
  expect(stored.sources.map(({ source_url, raw_text }) => ({ source_url, raw_text }))).toEqual([input, secondInput]);

  const beforeRetry = await readFile(file, "utf8");
  expect(await (await ingest(secondInput)).json()).toMatchObject({ status: "already_imported" });
  expect(callStructured).toHaveBeenCalledTimes(4);
  expect(await readFile(file, "utf8")).toBe(beforeRetry);
});

test("new books go through the API with no match call when the shortlist is empty", async () => {
  vi.mocked(callStructured).mockResolvedValue(reply({ items: [{ ...item, publisher: original.publisher }] }));
  const response = await ingest({ ...input, publisher_hint: "Fixture hint" });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "imported", source: { publisher: original.publisher },
    decisions: [{ match_status: "distinct_edition", candidate_book_id: null }],
  });
  expect((await readCatalog()).books[1]).toMatchObject({
    book_id: expect.stringMatching(/^bk_[0-9a-f]{12}$/), series_id: expect.stringMatching(/^sr_[0-9a-f]{12}$/),
    title: item.title, volume: 13, edition: "manga",
  });
  expect(callStructured).toHaveBeenCalledTimes(1);
});

test("a review-only result and a provider failure leave the catalog unchanged", async () => {
  const before = await readFile(file, "utf8");
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, edition_evidence: null }] }))
    .mockResolvedValueOnce(reply({ ...matchResult, edition: null }))
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title }] }))
    .mockRejectedValueOnce(new LlmUnavailableError(new Error("provider unavailable")));

  expect(await (await ingest()).json()).toMatchObject({
    status: "not_imported", decisions: [{ match_status: "needs_review" }],
  });
  expect((await ingest()).status).toBe(503);
  expect(await readFile(file, "utf8")).toBe(before);
});

test("concurrent announcements for an unseen title produce one stable book and both sources", async () => {
  const extractionBarrier = Promise.withResolvers<void>();
  let requests = 0;
  vi.mocked(callStructured).mockImplementation(async () => {
    requests += 1;
    if (requests === 2) extractionBarrier.resolve();
    await extractionBarrier.promise;
    return reply({ items: [{ ...item, publisher: original.publisher }] });
  });
  const responses = await Promise.all([ingest(), ingest(secondInput)]);
  const results = await Promise.all(responses.map((response) => response.json()));
  expect(results.map((result) => result.decisions[0].match_status).sort()).toEqual(["distinct_edition", "duplicate_merged"]);
  const stored = await readCatalog();
  expect(stored.books).toHaveLength(2);
  expect(stored.books[1].sources).toHaveLength(2);
  expect(stored.sources).toHaveLength(2);
});

test("reuses the ID of a seeded source and matches revised text at the same URL", async () => {
  const source = {
    ...input, source_id: "demo-existing-source", raw_text: `\n${input.raw_text}\n`,
    publisher: original.publisher, imported_at: "2026-01-01T00:00:00.000Z",
  };
  await writeFile(file, JSON.stringify({ ...catalog(original), sources: [source] }));
  expect(await (await ingest()).json()).toMatchObject({ status: "already_imported", source });
  expect(callStructured).not.toHaveBeenCalled();

  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title }] }))
    .mockResolvedValueOnce(reply(matchResult));
  const revised = { ...input, raw_text: secondInput.raw_text };
  expect(await (await ingest(revised)).json()).toMatchObject({
    status: "imported",
    source: { source_id: createSourceId(revised.raw_text, revised.source_url) },
  });
  expect((await readCatalog()).sources).toHaveLength(2);
});
