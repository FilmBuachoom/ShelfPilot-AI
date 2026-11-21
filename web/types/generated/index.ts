// Generated from schemas/ by npm run gen:types. Do not edit.

/**
 * This interface was referenced by `DataFiles`'s JSON-Schema
 * via the `definition` "book_id".
 */
export type BookId = string;
/**
 * This interface was referenced by `DataFiles`'s JSON-Schema
 * via the `definition` "edition".
 */
export type Edition = "manga" | "light_novel" | "special_set" | "big_book";
/**
 * This interface was referenced by `DataFiles`'s JSON-Schema
 * via the `definition` "source_id".
 */
export type SourceId = string;
/**
 * This interface was referenced by `DataFiles`'s JSON-Schema
 * via the `definition` "iso_date".
 */
export type IsoDate = string;
/**
 * This interface was referenced by `DataFiles`'s JSON-Schema
 * via the `definition` "match_status".
 */
export type MatchStatus = "duplicate_merged" | "distinct_edition" | "needs_review";

export interface DataFiles {
  "catalog.json": Catalog;
  "user_shelf.json": UserShelf;
  "review_queue.json": ReviewQueue;
  "store_clicks.json": StoreClicks;
}
export interface Catalog {
  books: Book[];
  sources: Source[];
  updated_at: IsoDate;
}
export interface Book {
  book_id: BookId;
  series_id: string;
  title: string;
  aliases: string[];
  volume: number;
  edition: Edition;
  publisher: string;
  release_date?: string;
  release_date_precision: "day" | "month";
  sale_status: "announced" | "preorder" | "released";
  sources: SourceId[];
  store_url?: string;
  cover_url?: string;
}
export interface Source {
  source_id: SourceId;
  source_url: string;
  raw_text: string;
  publisher: string;
  posted_at?: IsoDate;
  imported_at: IsoDate;
}
export interface UserShelf {
  owned: {
    book_id: BookId;
    added_at: IsoDate;
  }[];
  updated_at: IsoDate;
}
export interface ReviewQueue {
  items: {
    review_id: string;
    source_id: SourceId;
    extracted: {
      [k: string]: unknown;
    };
    candidates: {
      book_id: BookId;
      edition: Edition;
      confidence: number;
    }[];
    reason: string;
    status: "open" | "resolved";
    created_at: IsoDate;
  }[];
}
export interface StoreClicks {
  events: {
    book_id: BookId;
    clicked_at: IsoDate;
  }[];
}
