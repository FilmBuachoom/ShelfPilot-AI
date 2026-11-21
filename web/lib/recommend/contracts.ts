import type { BookId, SourceId } from "@/types/generated";

export type RecommendationItem = { book_id: BookId; source_ids: SourceId[]; reason?: string };

export type RecommendationGroups = {
  continue: RecommendationItem[];
  similar: RecommendationItem[];
};

export type RecommendationResponse = RecommendationGroups & {
  fallback: boolean;
  catalogVersion: string;
};

export function catalogVersion(updatedAt: string, bookCount: number) {
  return JSON.stringify([updatedAt, bookCount]);
}
