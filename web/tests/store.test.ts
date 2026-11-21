import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readCatalog, readReviewQueue, readShelf, writeJsonAtomic } from "@/lib/data/store";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "shelfpilot-store-"));
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("SHELFPILOT_DATA_DIR", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const readers = [
  ["catalog.json", readCatalog],
  ["user_shelf.json", readShelf],
  ["review_queue.json", readReviewQueue],
] as const;

test.each(readers)("reads the repository's %s", async (file, read) => {
  const expected = JSON.parse(await readFile(new URL(`../../data/${file}`, import.meta.url), "utf8"));

  await expect(read()).resolves.toEqual(expected);
});

test.each(readers)("reads the bundled demo %s on Vercel", async (file, read) => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SHELFPILOT_DATA_DIR", path.join(dir, "local-only"));
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "supabase"); // Older deployments may still have this set.
  const expected = JSON.parse(await readFile(new URL(`../../fixtures/demo/database/${file}`, import.meta.url), "utf8"));

  await expect(read()).resolves.toEqual(expected);
});

test("replaces JSON without leaving temporary files", async () => {
  const destination = path.join(dir, "payload.json");
  await writeJsonAtomic(destination, { value: "before" });
  await writeJsonAtomic(destination, { value: "after" });

  expect(JSON.parse(await readFile(destination, "utf8"))).toEqual({ value: "after" });
  expect(await readdir(dir)).toEqual(["payload.json"]);
});

test("cleans up if the rename fails", async () => {
  const destination = path.join(dir, "existing-directory");
  await mkdir(destination);

  await expect(writeJsonAtomic(destination, { value: "after" })).rejects.toThrow();
  expect(await readdir(dir)).toEqual(["existing-directory"]);
});
