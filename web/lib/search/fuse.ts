import "server-only";

import { readCatalog } from "@/lib/data/store";
import type { Book } from "@/types/generated";
import { createCatalogSearch } from "./catalog-search";
import { normalizeTitle } from "./normalize";

export async function searchCatalog(
  query: string,
  { limit = 5 }: { limit?: number } = {},
): Promise<Book[]> {
  if (!normalizeTitle(query) || limit <= 0) return [];

  const { books } = await readCatalog();
  const byId = new Map(books.map((book) => [book.book_id, book]));
  return createCatalogSearch(books)(query, limit).map((id) => byId.get(id)!);
}
