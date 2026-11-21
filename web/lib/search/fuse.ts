import "server-only";

import Fuse from "fuse.js";
import { readCatalog } from "@/lib/data/store";
import type { Book } from "@/types/generated";
import { normalizeTitle } from "./normalize";

export async function searchCatalog(
  query: string,
  { limit = 5 }: { limit?: number } = {},
): Promise<Book[]> {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const { books } = await readCatalog();
  const index = new Fuse(books, {
    ignoreLocation: true,
    keys: [
      { name: "title", getFn: (book) => normalizeTitle(book.title) },
      { name: "aliases", getFn: (book) => book.aliases.map(normalizeTitle) },
    ],
  });
  return index.search(normalizedQuery, { limit }).map(({ item }) => item);
}
