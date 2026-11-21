import "server-only";

import type { Book, Catalog } from "@/types/generated";
import type { IngestContext, MatchDecision, NormalizedItem } from "./contracts";
import type { CatalogMatch } from "./match";
import { createReviewId } from "./review-id";
import { matchingPublicationBooks, reviewSource, type ReviewItem } from "./review-record";
import type { UpdateReviewQueue } from "./storage";

export function findCompletedReviewSource(entries: readonly ReviewItem[]) {
  const first = entries[0];
  // A mixed import may have queued its review items before its catalog write succeeded.
  if (first && entries.length === first.extracted.item_count) return reviewSource(first);
}

function candidatesFor(books: readonly Book[], item: NormalizedItem, match: CatalogMatch | null, primary?: Book) {
  const confidence = Math.min(item.edition_confidence ?? 0, match?.edition_confidence ?? 1);
  const score = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0;
  return matchingPublicationBooks(books, item.title ?? "", primary ? [primary] : [])
    .filter((book) => item.volume === null ? book === primary : book.volume === item.volume)
    .map(({ book_id, edition }) => ({ book_id, edition, confidence: score }));
}

export function queueReviews(
  catalog: Catalog,
  context: IngestContext,
  matches: readonly (CatalogMatch | null)[],
  decisions: readonly MatchDecision[],
  updateReviewQueue: UpdateReviewQueue,
) {
  const { source, extraction } = context;
  const pending: ReviewItem[] = [];
  decisions.forEach((decision, index) => {
    if (decision.match_status !== "needs_review") return;
    const item = extraction.items[index];
    const match = matches[index] ?? null;
    const primary = match?.same_series
      ? catalog.books.find(({ book_id }) => book_id === match.candidate_book_id) : undefined;
    pending.push({
      review_id: createReviewId(source.source_id, index),
      source_id: source.source_id,
      extracted: { ...item, source, item_index: index, item_count: extraction.items.length, matched_book_id: primary?.book_id },
      candidates: candidatesFor(catalog.books, item, match, primary),
      reason: decision.reason,
      status: "open",
      created_at: source.imported_at,
    });
  });
  if (!pending.length) return;
  return updateReviewQueue((queue) => {
    const existing = new Set(queue.items.map(({ review_id }) => review_id));
    const added = pending.filter(({ review_id }) => !existing.has(review_id));
    return added.length ? { items: [...queue.items, ...added] } : queue;
  });
}
