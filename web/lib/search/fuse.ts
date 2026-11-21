import "server-only";

import { readCatalog } from "@/lib/data/store";
import type { Book, Edition } from "@/types/generated";
import { createCatalogSearch } from "./catalog-search";
import { normalizeTitle } from "./normalize";

interface SearchOptions {
  limit?: number;
  edition?: Edition;
  volume?: number | null;
}

export async function searchCatalog(query: string, options?: SearchOptions): Promise<Book[]> {
  if (!normalizeTitle(query) || (options?.limit ?? 5) <= 0) return [];
  const { books } = await readCatalog();
  return searchBooks(books, query, options);
}

export function searchBooks(
  books: readonly Book[],
  query: string,
  { limit = 5, edition, volume }: SearchOptions = {},
): Book[] {
  const normalized = normalizeTitle(query);
  if (!normalized || limit <= 0) return [];

  const eligible = edition ? books.filter((book) => book.edition === edition) : books;
  const byId = new Map(eligible.map((book) => [book.book_id, book]));
  const search = createCatalogSearch(eligible);
  const matches = search(normalized, volume == null ? limit : undefined).map((id) => byId.get(id)!);
  if (volume != null) {
    const priority = (book: Book) =>
      Number([book.title, ...book.aliases].some((title) => normalizeTitle(title) === normalized)) * 2
      + Number(book.volume === volume);
    matches.sort((left, right) => priority(right) - priority(left));
  }
  return matches.slice(0, limit);
}
