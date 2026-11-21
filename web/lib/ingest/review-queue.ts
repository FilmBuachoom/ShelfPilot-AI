import "server-only";

import { updateJsonAtomic } from "@/lib/data/store";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Book, Catalog } from "@/types/generated";
import type { IngestContext, MatchDecision, NormalizedItem } from "./contracts";
import type { CatalogMatch } from "./match";
import { createReviewId } from "./review-id";
import { reviewSource, type ReviewItem } from "./review-record";

let pendingWrite: Promise<unknown> = Promise.resolve();

export function withReviewWrite<T>(write: () => Promise<T>): Promise<T> {
  // Serialize the catalog and queue operations across local imports and approvals.
  const next = pendingWrite.catch(() => undefined).then(write);
  pendingWrite = next;
  return next;
}

export function findCompletedReviewSource(entries: readonly ReviewItem[]) {
  const first = entries[0];
  // A mixed import may have queued its review items before its catalog write succeeded.
  if (first && entries.length === first.extracted.item_count) return reviewSource(first);
}

function candidatesFor(books: readonly Book[], item: NormalizedItem, match: CatalogMatch | null) {
  const primary = match?.same_series ? books.find(({ book_id }) => book_id === match.candidate_book_id) : undefined;
  const title = normalizeTitle(item.title ?? "");
  const confidence = Math.min(item.edition_confidence ?? 0, match?.edition_confidence ?? 1);
  const score = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0;
  return books.filter((book) => (item.volume === null ? book === primary : book.volume === item.volume)
    && (primary ? book.series_id === primary.series_id
      : !!title && [book.title, ...book.aliases].some((name) => normalizeTitle(name) === title)))
    .map(({ book_id, edition }) => ({ book_id, edition, confidence: score }));
}

export function queueReviews(
  catalog: Catalog,
  context: IngestContext,
  matches: readonly (CatalogMatch | null)[],
  decisions: readonly MatchDecision[],
) {
  const { source, extraction } = context;
  const pending: ReviewItem[] = [];
  decisions.forEach((decision, index) => {
    if (decision.match_status !== "needs_review") return;
    const item = extraction.items[index];
    pending.push({
      review_id: createReviewId(source.source_id, index),
      source_id: source.source_id,
      extracted: { ...item, source, item_index: index, item_count: extraction.items.length },
      candidates: candidatesFor(catalog.books, item, matches[index] ?? null),
      reason: decision.reason,
      status: "open",
      created_at: source.imported_at,
    });
  });
  if (!pending.length) return;
  return updateJsonAtomic("review_queue.json", (queue) => {
    const existing = new Set(queue.items.map(({ review_id }) => review_id));
    const added = pending.filter(({ review_id }) => !existing.has(review_id));
    return added.length ? { items: [...queue.items, ...added] } : queue;
  });
}
