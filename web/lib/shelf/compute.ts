import type { Book, BookId, Edition, UserShelf } from "@/types/generated";

export type ShelfVolume = {
  book_id: BookId;
  volume: number;
  status: "owned" | "missing" | "upcoming";
};

export type ShelfSeries = {
  seriesId: string;
  edition: Edition;
  representative: Book;
  volumes: ShelfVolume[];
  owned: ShelfVolume[];
  missing: ShelfVolume[];
  upcoming: ShelfVolume[];
  total: number;
};

export type ShelfStats = { series: number; volumes: number; missing: number; upcoming: number };

export function seriesKey(seriesId: string, edition: Edition) {
  return JSON.stringify([seriesId, edition]);
}

export function computeShelf(books: readonly Book[], shelf: UserShelf) {
  const ownership = new Map(shelf.owned.map((entry) => [entry.book_id, entry.added_at]));
  const groups = new Map<string, Book[]>();

  for (const book of books) {
    const key = seriesKey(book.series_id, book.edition);
    const group = groups.get(key);
    if (group) group.push(book);
    else groups.set(key, [book]);
  }

  const allSeries = [...groups.values()].map((group) => {
    group.sort((a, b) => a.volume - b.volume);
    const volumes = group.map(({ book_id, volume, sale_status }): ShelfVolume => ({
      book_id,
      volume,
      status: ownership.has(book_id) ? "owned" : sale_status === "released" ? "missing" : "upcoming",
    }));
    const [first] = group;
    const row: ShelfSeries = {
      seriesId: first.series_id,
      edition: first.edition,
      representative: group.find((book) => book.cover_url) ?? first,
      volumes,
      owned: volumes.filter(({ status }) => status === "owned"),
      missing: volumes.filter(({ status }) => status === "missing"),
      upcoming: volumes.filter(({ status }) => status === "upcoming"),
      total: volumes.length,
    };
    return row;
  });

  function lastAdded(row: ShelfSeries) {
    return row.owned.reduce((latest, { book_id }) => Math.max(latest, Date.parse(ownership.get(book_id)!)), 0);
  }

  const series = allSeries
    .filter(({ owned }) => owned.length > 0)
    .sort((a, b) =>
      Number(Boolean(b.missing.length || b.upcoming.length)) - Number(Boolean(a.missing.length || a.upcoming.length))
      || lastAdded(b) - lastAdded(a)
      || a.representative.title.localeCompare(b.representative.title, "th"),
    );
  const stats = series.reduce<ShelfStats>((totals, row) => ({
    series: totals.series + 1,
    volumes: totals.volumes + row.owned.length,
    missing: totals.missing + row.missing.length,
    upcoming: totals.upcoming + row.upcoming.length,
  }), { series: 0, volumes: 0, missing: 0, upcoming: 0 });

  return { allSeries, series, stats };
}
