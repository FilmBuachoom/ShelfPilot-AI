import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";
import type { Catalog } from "@/types/generated";
import { runPipeline } from "@/lib/ingest/pipeline";
import { normalizeItem } from "@/lib/ingest/normalize";
import { createSourceId } from "@/lib/ingest/source-id";
import { input, item } from "./fixtures";

const catalog: Catalog = { books: [], sources: [], updated_at: "2026-01-01T00:00:00.000Z" };
const extraction = { items: [normalizeItem(item, input.raw_text)] };
const now = () => new Date("2026-01-01T00:00:00.000Z");

test("dry-run preserves the audit source in the result and writes nothing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ingest-test-"));
  const file = path.join(dir, "catalog.json");
  const before = JSON.stringify(catalog);
  try {
    await writeFile(file, before);
    const result = await runPipeline(input, {
      readCatalog: async () => JSON.parse(await readFile(file, "utf8")),
      extract: async () => extraction, now,
    });
    expect(result).toMatchObject({ status: "dry_run", extraction, source: {
      raw_text: input.raw_text, source_url: input.source_url, source_id: createSourceId(input.raw_text, input.source_url),
      publisher: "", imported_at: now().toISOString(),
    } });
    expect(await readFile(file, "utf8")).toBe(before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a persisted source skips extraction entirely", async () => {
  const extract = vi.fn();
  const source = { source_id: createSourceId(input.raw_text, input.source_url), source_url: input.source_url, raw_text: input.raw_text, publisher: "", imported_at: now().toISOString() };
  const result = await runPipeline(input, { readCatalog: async () => ({ ...catalog, sources: [source] }), extract });
  expect(result.status).toBe("already_imported");
  expect(extract).not.toHaveBeenCalled();
});

test("partial pipeline stages cannot write", async () => {
  const write = vi.fn();
  const result = await runPipeline(input, { readCatalog: async () => catalog, extract: async () => extraction, stages: { write } });
  expect(result.status).toBe("dry_run");
  expect(write).not.toHaveBeenCalled();
});

test("injected stages chain extract → match → disambiguate → write", async () => {
  const order: string[] = [];
  const result = await runPipeline(input, { readCatalog: async () => catalog,
    extract: async () => { order.push("extract"); return extraction; },
    stages: {
      match: async (context) => { order.push("match"); expect(context.extraction).toEqual(extraction); return ["match-a"]; },
      disambiguate: async (_context, matches) => { order.push("disambiguate"); expect(matches).toEqual(["match-a"]); return ["decision-a"]; },
      write: async (_context, decisions) => { order.push("write"); expect(decisions).toEqual(["decision-a"]); },
    },
  });
  expect(order).toEqual(["extract", "match", "disambiguate", "write"]);
  expect(result.status).toBe("imported");
});

test("extraction failure prevents later stages", async () => {
  const match = vi.fn();
  await expect(runPipeline(input, { readCatalog: async () => catalog,
    extract: async () => { throw new Error("timeout"); }, stages: { match },
  })).rejects.toThrow("timeout");
  expect(match).not.toHaveBeenCalled();
});
