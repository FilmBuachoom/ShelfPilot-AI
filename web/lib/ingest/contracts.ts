import type { Extraction } from "@/types/generated/extraction";
import type { BookId, Edition, MatchStatus, Source } from "@/types/generated";

export interface IngestInput {
  raw_text: string;
  source_url: string;
  publisher_hint?: string;
}

export type ExtractedItem = Extraction["items"][number];
export type NormalizedItem = Omit<ExtractedItem, "volume" | "release_date_precision"> & {
  volume: number | null;
  release_date_precision: "day" | "month" | "unknown";
};
export interface NormalizedExtraction { items: NormalizedItem[] }
export interface IngestContext {
  source: Source;
  extraction: NormalizedExtraction;
}
export interface MatchDecision {
  match_status: MatchStatus;
  candidate_book_id: BookId | null;
  matched_alias: string | null;
  reason: string;
}

export interface PipelineResult extends IngestContext {
  status: "already_imported" | "not_imported" | "imported";
  message: string;
  decisions: MatchDecision[];
}

export type ReviewResolution =
  | { review_id: string; action: "skip" }
  | { review_id: string; action: "merge"; book_id: BookId }
  | { review_id: string; action: "create"; edition: Edition };
