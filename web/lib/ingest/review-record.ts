import type { ReviewQueue, Source } from "@/types/generated";
import type { NormalizedItem } from "./contracts";

export type ReviewItem = ReviewQueue["items"][number];

export function reviewSource({ source_id, extracted }: ReviewItem): Source | undefined {
  const value = extracted.source;
  if (!value || typeof value !== "object") return;
  const { source_id: id, source_url, raw_text, publisher, imported_at } = value as Partial<Source>;
  if (id !== source_id || typeof source_url !== "string" || typeof raw_text !== "string"
    || typeof publisher !== "string" || typeof imported_at !== "string") return;
  return { source_id, source_url, raw_text, publisher, imported_at };
}

export function canCreateFromReview(item: ReviewItem): boolean {
  const { title, volume, publisher } = item.extracted;
  const source = reviewSource(item);
  return !!source && typeof title === "string" && !!title.trim()
    && typeof volume === "number" && Number.isFinite(volume) && volume >= 0
    && Boolean((typeof publisher === "string" && publisher.trim()) || source.publisher.trim());
}

// Embedded sources identify rows written by this pipeline with normalized extraction fields.
export function reviewDraft(item: ReviewItem): { source: Source; extracted: NormalizedItem } | undefined {
  const source = reviewSource(item);
  if (source) return { source, extracted: item.extracted as unknown as NormalizedItem };
}
