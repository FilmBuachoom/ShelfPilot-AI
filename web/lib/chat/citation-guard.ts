import "server-only";

import { logUnknownId } from "@/lib/data/hydrate";
import type { BookId, Catalog, SourceId } from "@/types/generated";

export interface CitationIds {
  book_ids: readonly BookId[];
  source_ids: readonly SourceId[];
}

export function createCitationGuard(catalog: Catalog) {
  const catalogBooks = new Set(catalog.books.map(({ book_id }) => book_id));
  const catalogSources = new Set(catalog.sources.map(({ source_id }) => source_id));
  const seenBooks = new Set<BookId>();
  const seenSources = new Set<SourceId>();

  return {
    record({ book_ids, source_ids }: CitationIds) {
      for (const id of book_ids) seenBooks.add(id);
      for (const id of source_ids) seenSources.add(id);
    },
    filter({ book_ids, source_ids }: CitationIds) {
      return {
        book_ids: filterIds(book_ids, "book_id", catalogBooks, seenBooks),
        source_ids: filterIds(source_ids, "source_id", catalogSources, seenSources),
      };
    },
  };
}

function filterIds(
  ids: readonly string[],
  field: "book_id" | "source_id",
  known: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): string[] {
  return [...new Set(ids)].filter((id) => {
    if (!known.has(id)) {
      logUnknownId(field, id);
      return false;
    }
    return seen.has(id);
  });
}
