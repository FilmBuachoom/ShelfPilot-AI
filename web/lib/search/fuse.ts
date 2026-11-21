import "server-only";

import { readCatalog } from "@/lib/data/store";
import type { Book, Edition } from "@/types/generated";
import { createCatalogSearch } from "./catalog-search";
import { normalizeTitle } from "./normalize";

interface SearchOptions {
  limit?: number;
  edition?: Edition;
}

export async function searchCatalog(query: string, options?: SearchOptions): Promise<Book[]> {
  if (!normalizeTitle(query) || (options?.limit ?? 5) <= 0) return [];
  const { books } = await readCatalog();
  return searchBooks(books, query, options);
}

export function searchBooks(
  books: readonly Book[],
  query: string,
  { limit = 5, edition }: SearchOptions = {},
): Book[] {
  const eligible = edition ? books.filter((book) => book.edition === edition) : books;
  const byId = new Map(eligible.map((book) => [book.book_id, book]));
  return createCatalogSearch(eligible)(query, limit).map((id) => byId.get(id)!);
}
