import "server-only";

import { readCatalog } from "@/lib/data/store";
import type { Book } from "@/types/generated";
import { createCatalogSearch } from "./catalog-search";
import { normalizeTitle } from "./normalize";

export async function searchCatalog(
  query: string,
  { limit = 5, volume, books }: { limit?: number; volume?: number | null; books?: readonly Book[] } = {},
): Promise<Book[]> {
  const normalized = normalizeTitle(query);
  if (!normalized || limit <= 0) return [];

  const entries = books ?? (await readCatalog()).books;
  const byId = new Map(entries.map((book) => [book.book_id, book]));
  const search = createCatalogSearch(entries);
  const prioritizeVolume = volume != null;
  const matches = search(normalized, prioritizeVolume ? undefined : limit).map((id) => byId.get(id)!);
  if (prioritizeVolume) {
    // Keep exact title and alias hits ahead of fuzzy hits for a different series.
    const priority = (book: Book) =>
      Number([book.title, ...book.aliases].some((title) => normalizeTitle(title) === normalized)) * 2
      + Number(book.volume === volume);
    matches.sort((left, right) => priority(right) - priority(left));
  }
  return matches.slice(0, limit);
}
