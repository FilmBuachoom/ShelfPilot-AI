import { expect, test } from "vitest";
import { computeReleases, daysUntilRelease, todayInBangkok } from "@/lib/shelf/releases";
import { book } from "./shelf-fixture";

test("sorts upcoming titles by date with undated announcements last and filters recent releases", () => {
  const books = [
    book("unknown", 1, { sale_status: "announced" }),
    book("later", 2, { sale_status: "announced", release_date: "2026-12-02" }),
    book("soon", 3, { sale_status: "preorder", release_date: "2026-11-24" }),
    book("latest", 4, { release_date: "2026-11-20" }),
    book("month", 5, { release_date: "2026-10-01", release_date_precision: "month" }),
    book("old", 6, { release_date: "2026-10-01" }),
  ];

  const { upcoming, recent } = computeReleases(books, "2026-11-21");
  expect(upcoming.map(({ book_id }) => book_id)).toEqual(["soon", "later", "unknown"]);
  expect(recent.map(({ book_id }) => book_id)).toEqual(["latest", "month"]);
});

test("uses the Bangkok day for countdowns and skips countdowns for month precision", () => {
  const today = todayInBangkok(new Date("2026-11-20T18:00:00Z"));
  expect(today).toBe("2026-11-21");
  const announced = book("fixture", 1, { sale_status: "announced", release_date: "2026-11-24" });
  expect(daysUntilRelease(announced, today)).toBe(3);
  expect(daysUntilRelease({ ...announced, release_date_precision: "month" }, today)).toBeNull();
});
