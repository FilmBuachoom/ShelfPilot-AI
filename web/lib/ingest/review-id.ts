import { createHash } from "node:crypto";

export function createReviewId(sourceId: string, itemIndex: number): string {
  if (!Number.isSafeInteger(itemIndex) || itemIndex < 0) {
    throw new RangeError("A review item requires a non-negative integer index");
  }
  const key = JSON.stringify([sourceId, itemIndex]);
  return `rv_${createHash("sha256").update(key).digest("hex").slice(0, 12)}`;
}
