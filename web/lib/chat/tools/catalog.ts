import "server-only";

import { pruneBook } from "@/lib/llm/prune";
import { searchBooks } from "@/lib/search/fuse";
import type { Book, Catalog, Edition, SourceId } from "@/types/generated";

export interface SearchCatalogArgs {
  query: string;
  edition?: Edition;
}

export interface ListReleasesArgs {
  from: string;
  to: string;
}

function toToolBook(book: Book, knownSources: ReadonlySet<SourceId>) {
  return {
    ...pruneBook(book),
    release_date: book.release_date_precision === "month"
      ? book.release_date?.slice(0, 7)
      : book.release_date,
    release_date_precision: book.release_date_precision,
    source_ids: [...new Set(book.sources)].filter((id) => knownSources.has(id)),
  };
}

export type ToolBook = ReturnType<typeof toToolBook>;

interface SearchGroup {
  series_id: string;
  edition: Edition;
  books: ToolBook[];
}

export function searchCatalogTool(catalog: Catalog, { query, edition }: SearchCatalogArgs) {
  const knownSources = new Set(catalog.sources.map(({ source_id }) => source_id));
  const groups = new Map<string, SearchGroup>();
  for (const book of searchBooks(catalog.books, query, { edition })) {
    const key = JSON.stringify([book.series_id, book.edition]);
    const group = groups.get(key);
    const pruned = toToolBook(book, knownSources);
    if (group) {
      group.books.push(pruned);
    } else {
      groups.set(key, { series_id: book.series_id, edition: book.edition, books: [pruned] });
    }
  }
  return { groups: [...groups.values()] };
}

export function listReleases(catalog: Catalog, { from, to }: ListReleasesArgs) {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return { error: "invalid_date_range" } as const;
  }

  const knownSources = new Set(catalog.sources.map(({ source_id }) => source_id));
  const books = catalog.books
    .filter((book) => overlapsReleaseWindow(book, from, to))
    .map((book) => toToolBook(book, knownSources))
    .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""));

  // Bound the model payload even if the requested window covers the entire catalog.
  const limit = 20;
  return { books: books.slice(0, limit), truncated: books.length > limit };
}

function overlapsReleaseWindow(book: Book, from: string, to: string): boolean {
  const date = book.release_date;
  if (date === undefined || !isIsoDate(date)) return false;
  if (book.release_date_precision === "month") {
    const month = date.slice(0, 7);
    return from.slice(0, 7) <= month && month <= to.slice(0, 7);
  }
  return from <= date && date <= to;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
