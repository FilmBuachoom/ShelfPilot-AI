import { computeShelf, seriesKey, type ShelfSeries } from "@/lib/shelf/compute";
import { computeReleases } from "@/lib/shelf/releases";
import type { Book, Catalog, SourceId, UserShelf } from "@/types/generated";

export type Candidate = { book: Book; source_ids: SourceId[] };
type ContinueCandidate = Candidate & { status: "missing" | "upcoming" };

const SIMILAR_LIMIT = 15;

export function buildCandidates(catalog: Catalog, shelf: UserShelf) {
  const { series, allSeries } = computeShelf(catalog.books, shelf);
  const books = new Map(catalog.books.map((book) => [book.book_id, book]));
  const knownSources = new Set(catalog.sources.map(({ source_id }) => source_id));
  const ownedSeries = new Set(series.map(({ seriesId }) => seriesId));
  const unownedSeries = new Map<string, Book>();
  const continuing: ContinueCandidate[] = [];

  function candidate(book: Book): Candidate {
    return { book, source_ids: book.sources.filter((source_id) => knownSources.has(source_id)) };
  }

  for (const row of series) {
    for (const { book_id } of row.missing) {
      continuing.push({ ...candidate(books.get(book_id)!), status: "missing" });
    }
    const lastOwned = row.owned[row.owned.length - 1];
    const next = row.upcoming.find(({ volume }) => volume > lastOwned.volume);
    if (next) {
      continuing.push({ ...candidate(books.get(next.book_id)!), status: "upcoming" });
    }
  }

  // Each edition row is sorted by volume; keep one starting volume per unowned title.
  for (const row of allSeries) {
    if (ownedSeries.has(row.seriesId)) continue;
    const first = books.get(row.volumes[0].book_id)!;
    const current = unownedSeries.get(row.seriesId);
    if (!current || first.volume < current.volume) unownedSeries.set(row.seriesId, first);
  }

  return {
    shelfSummary: series.map((row) => ({
      title: row.representative.title,
      edition: row.edition,
      owned_count: row.owned.length,
    })),
    continue: continuing,
    similar: [...unownedSeries.values()].slice(0, SIMILAR_LIMIT).map(candidate),
  };
}

export function personalReleases(books: Iterable<Book>, series: readonly ShelfSeries[], today: string) {
  const ownedEditions = new Set(series.map(({ seriesId, edition }) => seriesKey(seriesId, edition)));
  const matchingBooks = [...books].filter(({ series_id, edition }) => ownedEditions.has(seriesKey(series_id, edition)));
  const { upcoming, recent } = computeReleases(matchingBooks, today);
  return [...recent, ...upcoming].map(({ book_id, sources }) => ({ book_id, source_ids: sources }));
}
