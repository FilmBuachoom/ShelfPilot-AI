// Synthetic mocked extractor output; not publisher announcements or catalog seed data.
import type { ExtractedItem, IngestInput } from "@/lib/ingest/contracts";
import type { MatchResult } from "@/types/generated/match_result";

export const input: IngestInput = { raw_text: "fixture-a · มังงะ · เล่ม ๑๓", source_url: "https://example.test/source-a" };
export const item: ExtractedItem = {
  title: "fixture-a", publisher: null, volume: "เล่ม ๑๓", edition: "manga",
  edition_evidence: "มังงะ", edition_confidence: 0.95,
  release_date: "2026-10-02", release_date_precision: "day", sale_status: "announced",
};

export const matchResult: MatchResult = {
  candidate_book_id: "bk_target",
  same_series: true,
  same_volume: true,
  edition: "manga",
  edition_confidence: 0.95,
  matched_alias: null,
  reason: "ชื่อเรื่องและเลขเล่มตรงกัน",
};
