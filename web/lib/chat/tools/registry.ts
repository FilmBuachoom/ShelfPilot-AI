import "server-only";

import { getSeriesStatus, type SeriesStatusArgs } from "./series-status";
import { createCitationGuard } from "@/lib/chat/citation-guard";
import type { Catalog, UserShelf } from "@/types/generated";
import {
  listReleases,
  searchCatalogTool,
  type ListReleasesArgs,
  type SearchCatalogArgs,
  type ToolBook,
} from "./catalog";

interface ChatToolContext {
  catalog: Catalog;
  shelf: UserShelf;
}

// Create one registry for each chat turn so citation evidence cannot carry over.
export function createChatToolRegistry({ catalog, shelf }: ChatToolContext) {
  const citations = createCitationGuard(catalog);

  function recordBooks(books: ToolBook[]) {
    citations.record({
      book_ids: books.map(({ book_id }) => book_id),
      source_ids: books.flatMap(({ source_ids }) => source_ids),
    });
  }

  return {
    tools: {
      search_catalog(args: SearchCatalogArgs) {
        const result = searchCatalogTool(catalog, args);
        recordBooks(result.groups.flatMap(({ books }) => books));
        return result;
      },
      get_series_status(args: SeriesStatusArgs) {
        const result = getSeriesStatus(catalog, shelf, args);
        if (result.found) {
          citations.record({
            book_ids: [...result.owned, ...result.missing, ...result.upcoming, result.latest]
              .map(({ book_id }) => book_id),
            source_ids: result.latest.source_ids,
          });
        }
        return result;
      },
      list_releases(args: ListReleasesArgs) {
        const result = listReleases(catalog, args);
        if (result.books) recordBooks(result.books);
        return result;
      },
    },
    guardCitations: citations.filter,
  };
}
