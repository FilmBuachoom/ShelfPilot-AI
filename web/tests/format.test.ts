import { expect, test } from "vitest";
import { computeShelf, type ShelfVolume } from "@/lib/shelf/compute";
import { formatSeriesCount, formatVolumeCells, formatVolumes } from "@/lib/shelf/format";
import { book, shelf } from "./shelf-fixture";

test("formats missing volumes and complete counts", () => {
  const books = Array.from({ length: 13 }, (_, index) => book(String(index + 1), index + 1));
  const allIds = books.map(({ book_id }) => book_id);
  const partial = computeShelf(books, shelf(...allIds.filter((id) => id !== "9" && id !== "10")));
  const complete = computeShelf(books, shelf(...allIds));

  expect(formatSeriesCount(partial.series[0])).toBe("11/13 · ขาด 9, 10");
  expect(formatSeriesCount(complete.series[0])).toBe("13/13 · ครบแล้ว");
});

test("uses en dashes for ranges", () => {
  expect(formatVolumes(9)).toBe("เล่ม 9");
  expect(formatVolumes(9, 12)).toBe("เล่ม 9–12");
});

test("collapses only consecutive owned volumes when there are more than 30", () => {
  const volumes: ShelfVolume[] = Array.from({ length: 31 }, (_, index) => ({
    book_id: String(index + 1),
    volume: index + 1,
    status: index === 24 ? "missing" : "owned",
  }));

  expect(formatVolumeCells(volumes).map(({ label }) => label)).toEqual(["1–24 ✓", "25", "26–31 ✓"]);
  expect(formatVolumeCells(volumes.slice(0, 30))).toHaveLength(30);
  expect(formatVolumeCells(volumes, false)).toHaveLength(31);
});
