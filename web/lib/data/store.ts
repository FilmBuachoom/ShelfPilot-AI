import "server-only";

import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import demoCatalog from "../../../fixtures/demo/database/catalog.json";
import demoReviewQueue from "../../../fixtures/demo/database/review_queue.json";
import demoShelf from "../../../fixtures/demo/database/user_shelf.json";
import type { DataFiles } from "@/types/generated";
import { dataPath } from "./paths";

async function readJson<File extends keyof DataFiles>(file: File): Promise<DataFiles[File]> {
  return JSON.parse(await readFile(dataPath(file), "utf8")) as DataFiles[File];
}

// Bundle the demo snapshot so Vercel reads don't depend on the function's working directory.
export async function readCatalog(): Promise<DataFiles["catalog.json"]> {
  return process.env.VERCEL === "1" ? demoCatalog as DataFiles["catalog.json"] : readJson("catalog.json");
}

export async function readShelf(): Promise<DataFiles["user_shelf.json"]> {
  return process.env.VERCEL === "1" ? demoShelf : readJson("user_shelf.json");
}

export async function readReviewQueue(): Promise<DataFiles["review_queue.json"]> {
  return process.env.VERCEL === "1" ? demoReviewQueue as DataFiles["review_queue.json"] : readJson("review_queue.json");
}

export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  if (process.env.VERCEL === "1") throw new Error("The Vercel demo snapshot is read-only.");
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
