import { expect, test } from "vitest";
import { answerQuick } from "@/lib/chat/quick";
import { computeShelf } from "@/lib/shelf/compute";
import { book, shelf } from "./shelf-fixture";

test("answers quick actions from the shelf and Bangkok month without inventing a release day", () => {
  const books = [
    book("owned", 1, { release_date: "2026-10-11" }),
    book("missing", 2, { release_date: "2026-11-01", release_date_precision: "month" }),
    book("upcoming", 3, { release_date: "2026-11-23", sale_status: "preorder" }),
    book("different", 4, { series_id: "other-series", release_date: "2026-11-22" }),
  ];
  const byId = new Map(books.map((entry) => [entry.book_id, entry]));
  const { series } = computeShelf(books, shelf("owned"));
  const today = "2026-11-21";

  expect(answerQuick("missing", byId, series, today).book_ids).toEqual(["missing"]);
  expect(answerQuick("this_month", byId, series, today).book_ids).toEqual(["missing"]);
  expect(answerQuick("upcoming", byId, series, today).book_ids).toEqual(["upcoming"]);
  expect(answerQuick("missing", new Map(), [], today)).toMatchObject({ not_found: true, book_ids: [] });
});
