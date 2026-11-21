import { createHash } from "node:crypto";

// Keep spelling, case and digits intact: a changed fact must produce a new ID.
export function normalizeSourceText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function createSourceId(rawText: string, sourceUrl: string): string {
  const input = JSON.stringify([normalizeSourceText(rawText), sourceUrl.trim()]);
  return `src_${createHash("sha256").update(input).digest("hex").slice(0, 12)}`;
}
