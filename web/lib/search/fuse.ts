import "server-only";

import Fuse from "fuse.js";
import { readCatalog } from "@/lib/data/store";
import type { Book, Edition } from "@/types/generated";
import { normalizeTitle } from "./normalize";

export async function searchCatalog(
  query: string,
  options?: SearchOptions,
): Promise<Book[]> {
  if (!normalizeTitle(query) || (options?.limit ?? 5) <= 0) return [];
  const { books } = await readCatalog();
  return searchBooks(books, query, options);
}

interface SearchOptions {
  limit?: number;
  edition?: Edition;
}

export function searchBooks(
  books: readonly Book[],
  query: string,
  { limit = 5, edition }: SearchOptions = {},
): Book[] {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const eligibleBooks = edition ? books.filter((book) => book.edition === edition) : books;
  const index = new Fuse(eligibleBooks, {
    ignoreLocation: true,
    keys: [
      { name: "title", getFn: (book) => normalizeTitle(book.title) },
      { name: "aliases", getFn: (book) => book.aliases.map(normalizeTitle) },
    ],
  });
  return index.search(normalizedQuery, { limit }).map(({ item }) => item);
}
