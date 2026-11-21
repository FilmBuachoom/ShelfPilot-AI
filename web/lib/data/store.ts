import "server-only";

import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DataFiles } from "@/types/generated";
import { dataPath } from "./paths";
import {
  readSupabaseCatalog, readSupabaseReviewQueue, readSupabaseShelf,
} from "./supabase-demo";
import { usesSupabaseDemo } from "./supabase-demo-access";

async function readJson<File extends keyof DataFiles>(file: File): Promise<DataFiles[File]> {
  return JSON.parse(await readFile(dataPath(file), "utf8")) as DataFiles[File];
}

export function readCatalog() {
  return usesSupabaseDemo() ? readSupabaseCatalog() : readJson("catalog.json");
}

export function readShelf() {
  return usesSupabaseDemo() ? readSupabaseShelf() : readJson("user_shelf.json");
}

export function readReviewQueue() {
  return usesSupabaseDemo() ? readSupabaseReviewQueue() : readJson("review_queue.json");
}

export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (json === undefined) {
    throw new TypeError("Expected a JSON value");
  }

  // Keep the temporary file on the destination filesystem so rename is atomic.
  const tempDir = await mkdtemp(path.join(path.dirname(file), ".shelfpilot-"));
  const tempFile = path.join(tempDir, "data.json");
  try {
    await writeFile(tempFile, `${json}\n`, "utf8");
    await rename(tempFile, file);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const pendingUpdates = new Map<string, Promise<unknown>>();

export async function updateJsonAtomic<File extends keyof DataFiles>(
  file: File,
  update: (current: DataFiles[File]) => DataFiles[File],
): Promise<DataFiles[File]> {
  if (usesSupabaseDemo()) throw new Error("File updates are disabled in Supabase demo mode.");
  const destination = dataPath(file);
  const previous = pendingUpdates.get(destination);
  // Keep each read/modify/write together across concurrent requests in the local server.
  const next = (previous?.catch(() => undefined) ?? Promise.resolve()).then(async () => {
    const current = await readJson(file);
    const updated = update(current);
    if (updated !== current) await writeJsonAtomic(destination, updated);
    return updated;
  });

  pendingUpdates.set(destination, next);
  try {
    return await next;
  } finally {
    if (pendingUpdates.get(destination) === next) pendingUpdates.delete(destination);
  }
}
