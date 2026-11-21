import { expect, test } from "vitest";
import { computeShelf } from "@/lib/shelf/compute";
import { book, shelf } from "./shelf-fixture";

test("counts known owned, missing and upcoming volumes in tracked series", () => {
  const books = [
    book("fixture-4", 4, { sale_status: "preorder" }),
    book("fixture-2", 2),
    book("fixture-1", 1),
    book("fixture-3", 3, { sale_status: "announced" }),
    book("other-1", 1, { series_id: "other-series" }),
  ];
  const result = computeShelf(books, shelf("fixture-1", "fixture-4", "removed-from-catalog"));
  const [row] = result.series;

  expect(result.stats).toEqual({ series: 1, volumes: 2, missing: 1, upcoming: 1 });
  expect(row.owned.map(({ volume }) => volume)).toEqual([1, 4]);
  expect(row.missing.map(({ volume }) => volume)).toEqual([2]);
  expect(row.upcoming.map(({ volume }) => volume)).toEqual([3]);
  expect(row.total).toBe(4);
  expect(result.allSeries).toHaveLength(2);
});

test("keeps manga and novels separate and lists incomplete rows first", () => {
  const books = [
    book("novel-1", 1, { edition: "light_novel" }),
    book("manga-1", 1),
    book("manga-2", 2),
  ];

  const { series } = computeShelf(books, shelf("manga-1", "novel-1"));
  expect(series.map(({ edition, total }) => [edition, total])).toEqual([["manga", 2], ["light_novel", 1]]);
});

test("returns zero counts for an empty catalog even if the shelf has an old ID", () => {
  expect(computeShelf([], shelf("old-id"))).toEqual({
    allSeries: [],
    series: [],
    stats: { series: 0, volumes: 0, missing: 0, upcoming: 0 },
  });
});
