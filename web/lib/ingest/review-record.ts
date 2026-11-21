import common from "../../../schemas/common.schema.json";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Book, Edition, ReviewQueue, Source } from "@/types/generated";
import type { NormalizedItem, ReviewResolution } from "./contracts";

export type ReviewItem = ReviewQueue["items"][number];

export function matchingPublicationBooks(books: readonly Book[], title: string, anchors: readonly Book[]) {
  const seriesIds = new Set(anchors.map(({ series_id }) => series_id));
  const titles = [title, ...anchors.flatMap((book) => [book.title, ...book.aliases])];
  const normalizedTitles = new Set(titles.map(normalizeTitle).filter(Boolean));
  return books.filter((book) => seriesIds.has(book.series_id)
    || [book.title, ...book.aliases].some((name) => normalizedTitles.has(normalizeTitle(name))));
}

export function reviewPublicationBooks(books: readonly Book[], item: ReviewItem) {
  const { title, matched_book_id } = item.extracted;
  const knownIds = new Set(item.candidates.map(({ book_id }) => book_id));
  if (typeof matched_book_id === "string") knownIds.add(matched_book_id);
  const anchors = books.filter(({ book_id }) => knownIds.has(book_id));
  return matchingPublicationBooks(books, typeof title === "string" ? title : "", anchors);
}

export function creationReferences(books: readonly Book[], item: ReviewItem) {
  const volume = item.extracted.volume;
  if (typeof volume !== "number") return [];
  const references = new Map<string, Book>();
  for (const book of reviewPublicationBooks(books, item)) {
    const prior = references.get(book.series_id);
    if (!prior || Math.abs(book.volume - volume) < Math.abs(prior.volume - volume)) {
      references.set(book.series_id, book);
    }
  }
  return [...references.values()];
}

function isRecordId(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 200;
}

export function parseReviewResolution(value: unknown): ReviewResolution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { review_id, action, book_id, edition } = value as Record<string, unknown>;
  if (!isRecordId(review_id)) return;
  if (action === "skip") return { review_id, action };
  if (action === "merge" && isRecordId(book_id)) return { review_id, action, book_id };
  if (action === "create" && typeof edition === "string" && common.$defs.edition.enum.includes(edition)
    && (book_id === undefined || isRecordId(book_id))) {
    return { review_id, action, edition: edition as Edition, book_id };
  }
}

export function pendingReviewResolution(item: ReviewItem): ReviewResolution | undefined {
  if (item.status !== "open") return;
  const resolution = parseReviewResolution(item.extracted.resolution);
  if (resolution?.review_id === item.review_id) return resolution;
}

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
