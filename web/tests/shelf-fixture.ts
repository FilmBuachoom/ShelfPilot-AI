import type { Book, Catalog, UserShelf } from "@/types/generated";

export const timestamp = "2026-11-21T00:00:00+07:00";

export function book(book_id: string, volume: number, overrides: Partial<Book> = {}): Book {
  return {
    book_id,
    series_id: "series-fixture",
    title: "ชุดทดสอบ",
    aliases: ["テスト", "Test Series"],
    volume,
    edition: "manga",
    publisher: "สำนักพิมพ์ทดสอบ",
    release_date_precision: "day",
    sale_status: "released",
    sources: [],
    ...overrides,
  };
}

export function catalog(...books: Book[]): Catalog {
  return { books, sources: [], updated_at: timestamp };
}

export function shelf(...ids: string[]): UserShelf {
  return { owned: ids.map((book_id) => ({ book_id, added_at: timestamp })), updated_at: timestamp };
}
