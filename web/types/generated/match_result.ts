// Generated from schemas/ by npm run gen:types. Do not edit.

export type Edition = "manga" | "light_novel" | "special_set" | "big_book";

export interface MatchResult {
  candidate_book_id: string | null;
  same_series: boolean;
  same_volume: boolean;
  edition: Edition | null;
  edition_confidence: number;
  matched_alias: string | null;
  reason: string;
}
