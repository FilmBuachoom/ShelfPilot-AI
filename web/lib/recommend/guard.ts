import { logUnknownId } from "@/lib/data/unknown-id";
import type { RecommendationEntry } from "@/types/generated/recommendation";
import type { Candidate } from "./candidates";
import type { RecommendationItem } from "./contracts";

export function guardRecommendations(items: RecommendationEntry[], candidates: Candidate[]): RecommendationItem[] {
  const sourcesByBook = new Map(candidates.map(({ book, source_ids }) => [book.book_id, new Set(source_ids)]));
  const results: RecommendationItem[] = [];
  const seen = new Set<string>();

  for (const { book_id, reason, source_ids } of items) {
    const allowedSources = sourcesByBook.get(book_id);
    if (!allowedSources) {
      logUnknownId("book_id", book_id);
      continue;
    }
    if (seen.has(book_id)) continue;
    seen.add(book_id);

    const validSources = [...new Set(source_ids)].filter((source_id) => {
      if (allowedSources.has(source_id)) return true;
      logUnknownId("source_id", source_id);
      return false;
    });
    if (validSources.length && reason.trim()) {
      results.push({ book_id, reason: reason.trim(), source_ids: validSources });
    } else {
      results.push({ book_id, source_ids: validSources });
    }
  }
  return results;
}
