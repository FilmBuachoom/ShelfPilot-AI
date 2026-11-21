// Generated from schemas/ by npm run gen:types. Do not edit.

export type Edition = "manga" | "light_novel" | "special_set" | "big_book";

export interface Extraction {
  items: ExtractedItem[];
}
export interface ExtractedItem {
  title: string | null;
  publisher: string | null;
  /**
   * A single stated volume, including decimal volumes. Preserve Thai digits and prefixes for code normalization.
   */
  volume: number | string | null;
  edition: Edition | null;
  edition_evidence: string | null;
  edition_confidence: number | null;
  /**
   * YYYY-MM-DD for an explicit day; null for month-only or absent dates. Never invent a day.
   */
  release_date: string | null;
  release_date_precision: "day" | "month" | "unknown" | null;
  sale_status: "announced" | "preorder" | "released" | null;
}
