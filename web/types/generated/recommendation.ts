// Generated from schemas/ by npm run gen:types. Do not edit.

export type BookId = string;
export type SourceId = string;

export interface Recommendation {
  continue: RecommendationEntry[];
  similar: RecommendationEntry[];
}
export interface RecommendationEntry {
  book_id: BookId;
  reason: string;
  source_ids: SourceId[];
}
