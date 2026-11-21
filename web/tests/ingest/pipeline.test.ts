import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { POST as resolve } from "@/app/api/review/resolve/route";
import * as store from "@/lib/data/store";
import { readCatalog, readReviewQueue } from "@/lib/data/store";
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
  await writeFile(path.join(dir, "review_queue.json"), JSON.stringify({ items: [] }));
  vi.stubEnv("SHELFPILOT_DATA_DIR", dir);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "json");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
  expect((await ingest(secondInput)).status).toBe(503);
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


function approve(body: Record<string, unknown>, origin = "http://127.0.0.1:3000") {
  return resolve(new Request("http://localhost:3000/api/review/resolve", {
    method: "POST",
    headers: { Host: "127.0.0.1:3000", Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

test("queues a missing edition with both candidates and changes only the approved book", async () => {
  const otherEdition = { ...original, book_id: "bk_novel", edition: "light_novel" as const };
  await writeFile(file, JSON.stringify(catalog(original, otherEdition)));
  const before = await readFile(file, "utf8");
  const ambiguous = { ...input, raw_text: `${original.title} · เล่ม ๑๓` };
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title }] }))
    .mockResolvedValueOnce(reply({ ...matchResult, edition: null }));

  expect(await (await ingest(ambiguous)).json()).toMatchObject({
    status: "not_imported", decisions: [{ match_status: "needs_review" }],
  });
  const { items: [record] } = await readReviewQueue();
  expect(record).toMatchObject({
    review_id: expect.stringMatching(/^rv_[0-9a-f]{12}$/),
    extracted: { source: { raw_text: ambiguous.raw_text } },
    status: "open",
    candidates: [{ book_id: original.book_id, edition: "manga" }, { book_id: otherEdition.book_id, edition: "light_novel" }],
  });
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await (await ingest(ambiguous)).json()).toMatchObject({ status: "already_imported" });
  expect((await readReviewQueue()).items).toHaveLength(1);
  expect(callStructured).toHaveBeenCalledTimes(2);

  const resolution = { review_id: record.review_id, action: "merge", book_id: otherEdition.book_id };
  expect((await approve(resolution, "https://elsewhere.example")).status).toBe(404);
  expect((await approve({ ...resolution, book_id: "bk_not_offered" })).status).toBe(409);
  expect(await readFile(file, "utf8")).toBe(before);
  expect((await approve(resolution)).status).toBe(200);
  const approved = await readCatalog();
  expect(approved.sources.map(({ source_id }) => source_id)).toEqual([record.source_id]);
  expect(approved.books[0]).toEqual(original);
  expect(approved.books[1].sources).toEqual([record.source_id]);
  expect((await readReviewQueue()).items[0].status).toBe("resolved");
  expect((await approve({ ...resolution, book_id: original.book_id })).status).toBe(200);
  expect(await readCatalog()).toEqual(approved);
});

test("honors the matcher score below 0.8 and accepts 0.8 exactly", async () => {
  const before = await readFile(file, "utf8");
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, edition_confidence: 0.95 }] }))
    .mockResolvedValueOnce(reply({ ...matchResult, edition_confidence: 0.79 }))
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, edition_confidence: 0.8 }] }))
    .mockResolvedValueOnce(reply({ ...matchResult, edition_confidence: 0.8 }));

  expect(await (await ingest()).json()).toMatchObject({
    decisions: [{ match_status: "needs_review", reason: "ความมั่นใจ 0.79 < 0.8" }],
  });
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await (await ingest(secondInput)).json()).toMatchObject({
    decisions: [{ match_status: "duplicate_merged" }],
  });
  expect((await readCatalog()).books).toHaveLength(1);
});

test("keeps a second title from inheriting the first title's edition evidence", async () => {
  const raw_text = `${original.title} · มังงะ · เล่ม 13\nfixture-second · เล่ม 13`;
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [
      { ...item, title: original.title }, { ...item, title: "fixture-second", publisher: original.publisher },
    ] }))
    .mockResolvedValueOnce(reply(matchResult));

  const result = await (await ingest({ ...input, raw_text })).json();
  expect(result).toMatchObject({
    status: "imported",
    decisions: [{ match_status: "duplicate_merged" }, { match_status: "needs_review" }],
  });
  expect((await readCatalog()).books).toHaveLength(1);
  expect((await readReviewQueue()).items).toMatchObject([{ extracted: { title: "fixture-second" }, status: "open" }]);
});

test("creates a distinct human-approved edition and skips another without a write", async () => {
  vi.mocked(callStructured)
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, publisher: original.publisher, edition_confidence: 0.6 }] }))
    .mockResolvedValueOnce(reply(matchResult))
    .mockResolvedValueOnce(reply({ items: [{ ...item, title: original.title, edition_evidence: null }] }))
    .mockResolvedValueOnce(reply(matchResult));

  await ingest();
  await ingest(secondInput);
  const { items: [creation, skipping] } = await readReviewQueue();
  expect((await approve({ review_id: creation.review_id, action: "create", edition: "manga" })).status).toBe(409);
  expect((await approve({ review_id: creation.review_id, action: "create", edition: "light_novel" })).status).toBe(200);
  const after = await readFile(file, "utf8");
  expect((await readCatalog()).books).toMatchObject([
    original, { edition: "light_novel", series_id: original.series_id, sources: [creation.source_id] },
  ]);
  expect((await approve({ review_id: skipping.review_id, action: "skip" })).status).toBe(200);
  expect(await readFile(file, "utf8")).toBe(after);
  expect((await readReviewQueue()).items.map(({ status }) => status)).toEqual(["resolved", "resolved"]);
});


test("a catalog write failure leaves a mixed import retryable without losing or duplicating its review item", async () => {
  const raw_text = `${original.title} · มังงะ · เล่ม 13\nfixture-second · เล่ม 13`;
  const mixed = { ...input, raw_text };
  const extraction = { items: [
    { ...item, title: original.title }, { ...item, title: "fixture-second", publisher: original.publisher },
  ] };
  vi.mocked(callStructured).mockImplementation(async (call) =>
    reply(call.schema.name === "extraction" ? extraction : matchResult));

  const update = store.updateJsonAtomic;
  let failCatalog = true;
  vi.spyOn(store, "updateJsonAtomic").mockImplementation((name, transform) => {
    if (name === "catalog.json" && failCatalog) {
      failCatalog = false;
      return Promise.reject(new Error("Fixture write failure"));
    }
    return update(name, transform);
  });

  const before = await readFile(file, "utf8");
  expect((await ingest(mixed)).status).toBe(500);
  const { items: [review] } = await readReviewQueue();
  expect(await readFile(file, "utf8")).toBe(before);
  expect((await approve({ review_id: review.review_id, action: "create", edition: "light_novel" })).status).toBe(409);

  expect(await (await ingest(mixed)).json()).toMatchObject({
    status: "imported",
    decisions: [{ match_status: "duplicate_merged" }, { match_status: "needs_review" }],
  });
  expect((await readReviewQueue()).items).toEqual([review]);
  expect((await readCatalog()).books[0].sources).toEqual([review.source_id]);
});
