import "server-only";

import { computeShelf } from "@/lib/shelf/compute";
import type { Catalog, Edition, UserShelf } from "@/types/generated";

export interface SeriesStatusArgs {
  series_id: string;
  edition: Edition;
}

export function getSeriesStatus(catalog: Catalog, shelf: UserShelf, { series_id, edition }: SeriesStatusArgs) {
  const books = catalog.books.filter((book) => book.series_id === series_id && book.edition === edition);
  const { allSeries: [series] } = computeShelf(books, shelf);
  if (!series) return { found: false } as const;

  // computeShelf orders the volumes by number.
  const latestId = series.volumes.at(-1)?.book_id;
  const latest = books.find(({ book_id }) => book_id === latestId);
  if (!latest) return { found: false } as const;

  const knownSources = new Set(catalog.sources.map(({ source_id }) => source_id));
  const sampleLimit = 20;
  return {
    found: true,
    title: series.representative.title,
    edition,
    counts: { owned: series.owned.length, missing: series.missing.length, upcoming: series.upcoming.length },
    owned: series.owned.slice(0, sampleLimit),
    missing: series.missing.slice(0, sampleLimit),
    upcoming: series.upcoming.slice(0, sampleLimit),
    latest: {
      book_id: latest.book_id,
      volume: latest.volume,
      sale_status: latest.sale_status,
      source_ids: latest.sources.filter((id) => knownSources.has(id)),
    },
  } as const;
}
