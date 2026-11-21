import { expect, test } from "vitest";
import { buildCandidates, personalReleases } from "@/lib/recommend/candidates";
import { computeShelf } from "@/lib/shelf/compute";
import { book, catalog, shelf, timestamp } from "../shelf-fixture";

test("counts missing and next announced volumes separately for each owned edition", () => {
  const volumes = Array.from({ length: 13 }, (_, index) => book(`manga-${index + 1}`, index + 1));
  const books = catalog(
    ...volumes,
    book("manga-14", 14, { sale_status: "announced", sources: ["source-14", "unknown"] }),
    book("manga-15", 15, { sale_status: "preorder" }),
    book("novel-1", 1, { edition: "light_novel" }),
    book("novel-2", 2, { edition: "light_novel" }),
    book("novel-3", 3, { edition: "light_novel", sale_status: "announced" }),
    book("big-1", 1, { edition: "big_book" }),
  );
  books.sources = [{
    source_id: "source-14",
    source_url: "https://example.test/source-14",
    publisher: "สำนักพิมพ์ทดสอบ",
    raw_text: "ประกาศทดสอบ",
    imported_at: timestamp,
  }];
  const allOwned = shelf(...volumes.map(({ book_id }) => book_id));
  expect(buildCandidates(books, allOwned).continue.map(({ book }) => book.book_id)).toEqual(["manga-14"]);

  const withGaps = shelf("novel-1", ...volumes.filter(({ volume }) => volume !== 9 && volume !== 10)
    .map(({ book_id }) => book_id));
  const result = buildCandidates(books, withGaps);

  expect(result.continue.map(({ book, status }) => [book.book_id, status])).toEqual(expect.arrayContaining([
    ["manga-9", "missing"], ["manga-10", "missing"], ["manga-14", "upcoming"],
    ["novel-2", "missing"], ["novel-3", "upcoming"],
  ]));
  expect(result.continue).toHaveLength(5);
  expect(result.continue.find(({ book }) => book.book_id === "manga-14")?.source_ids).toEqual(["source-14"]);
  expect(result.similar).toEqual([]);
  expect(result.shelfSummary).toEqual(expect.arrayContaining([
    expect.objectContaining({ edition: "manga", owned_count: 11 }),
    expect.objectContaining({ edition: "light_novel", owned_count: 1 }),
  ]));
});

test("offers up to 15 distinct unowned titles starting from their lowest catalogued volume", () => {
  const titles = Array.from({ length: 20 }, (_, index) => book(`title-${index}`, 1, { series_id: `series-${index}` }));
  const input = catalog(book("mine", 1), book("later", 2, { series_id: "series-0" }), ...titles);
  const result = buildCandidates(input, shelf("mine"));

  expect(result.similar.map(({ book }) => book.book_id)).toEqual(titles.slice(0, 15).map(({ book_id }) => book_id));
});

test("personal feed includes recent and upcoming books from the owned edition", () => {
  const books = [
    book("owned", 1),
    book("recent", 2, { release_date: "2026-11-10" }),
    book("upcoming", 3, { sale_status: "preorder", release_date: "2026-12-01" }),
    book("novel", 1, { edition: "light_novel", sale_status: "announced" }),
    book("old", 4, { release_date: "2026-10-01" }),
  ];
  const collection = computeShelf(books, shelf("owned"));

  expect(personalReleases(books, collection.series, "2026-11-21").map(({ book_id }) => book_id))
    .toEqual(["recent", "upcoming"]);
  expect(collection.stats.missing).toBe(2);
});
