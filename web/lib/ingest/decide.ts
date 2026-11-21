import type { Book, MatchStatus } from "@/types/generated";
import type { NormalizedItem } from "./contracts";
import type { CatalogMatch } from "./match";

export function decideMatchStatus(
  item: NormalizedItem,
  match: CatalogMatch | null,
  candidate: Book | undefined,
): MatchStatus {
  if (!item.title || item.volume === null || !item.edition) return "needs_review";
  if (match?.rejectedCandidate || (match?.edition && match.edition !== item.edition)) return "needs_review";

  if (!match) return "distinct_edition";
  if (match.candidate_book_id === null) {
    return match.same_series || match.same_volume ? "needs_review" : "distinct_edition";
  }
  if (!candidate || candidate.book_id !== match.candidate_book_id || !match.same_series
    || !match.same_volume || candidate.volume !== item.volume) return "needs_review";

  return candidate.edition === item.edition ? "duplicate_merged" : "distinct_edition";
}
