import type { Extraction } from "@/types/generated/extraction";
import type { Source } from "@/types/generated";

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
export interface PipelineResult extends IngestContext {
  status: "already_imported" | "dry_run" | "imported";
  message: string;
}
