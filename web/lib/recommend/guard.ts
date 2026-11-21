import { logUnknownId } from "@/lib/data/unknown-id";
import type { RecommendationEntry } from "@/types/generated/recommendation";
import type { Candidate } from "./candidates";
import type { RecommendationItem } from "./contracts";

export function guardRecommendations<T extends Candidate>(
  items: RecommendationEntry[], candidates: T[], reasonFor: (candidate: T) => string | undefined,
): RecommendationItem[] {
  const candidatesByBook = new Map(candidates.map((candidate) => [candidate.book.book_id, candidate]));
  const results: RecommendationItem[] = [];
  const seen = new Set<string>();

  for (const { book_id, source_ids } of items) {
    const candidate = candidatesByBook.get(book_id);
    if (!candidate) {
      logUnknownId("book_id", book_id);
      continue;
    }
    if (seen.has(book_id)) continue;
    seen.add(book_id);

    const allowedSources = new Set(candidate.source_ids);
    const validSources = [...new Set(source_ids)].filter((source_id) => {
      if (allowedSources.has(source_id)) return true;
      logUnknownId("source_id", source_id);
      return false;
    });
    const reason = reasonFor(candidate);
    if (validSources.length && reason) {
      results.push({ book_id, reason, source_ids: validSources });
    } else {
      results.push({ book_id, source_ids: validSources });
    }
  }
  return results;
}
