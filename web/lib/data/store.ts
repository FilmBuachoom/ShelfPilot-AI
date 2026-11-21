import "server-only";

import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DataFiles } from "@/types/generated";
import { dataPath } from "./paths";

async function readJson<File extends keyof DataFiles>(file: File): Promise<DataFiles[File]> {
  return JSON.parse(await readFile(dataPath(file), "utf8")) as DataFiles[File];
}

export function readCatalog() {
  return readJson("catalog.json");
}

export function readShelf() {
  return readJson("user_shelf.json");
}

export function readReviewQueue() {
  return readJson("review_queue.json");
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
