import Fuse from "fuse.js";
import type { Book } from "@/types/generated";
import { normalizeTitle } from "./normalize";

type SearchableBook = Pick<Book, "book_id" | "title" | "aliases">;

export function createCatalogSearch(books: readonly SearchableBook[]) {
  const index = new Fuse(books.map(({ book_id, title, aliases }) => ({
    book_id,
    title: normalizeTitle(title),
    aliases: aliases.map(normalizeTitle),
  })), {
    ignoreLocation: true,
    keys: ["title", "aliases"],
  });

  return function searchCatalog(query: string, limit?: number) {
    const normalized = normalizeTitle(query);
    if (!normalized || (limit !== undefined && limit <= 0)) return [];
    return index.search(normalized, { limit }).map(({ item }) => item.book_id);
  };
}
