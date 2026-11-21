import { expect, test, vi } from "vitest";
import { logUnknownId } from "@/lib/data/unknown-id";
import { guardRecommendations } from "@/lib/recommend/guard";
import { book } from "../shelf-fixture";

vi.mock("@/lib/data/unknown-id", () => ({ logUnknownId: vi.fn() }));

test("drops books outside the group and sources outside the book", () => {
  const candidates = [{ book: book("allowed", 1), source_ids: ["linked"] }];
  const result = guardRecommendations([
    { book_id: "wrong-group", reason: "อยู่อีกกลุ่ม", source_ids: ["linked"] },
    { book_id: "allowed", reason: "เหตุผล", source_ids: ["mismatch", "linked", "linked"] },
    { book_id: "allowed", reason: "ซ้ำ", source_ids: ["linked"] },
  ], candidates, () => "เหตุผลที่ตรวจสอบแล้ว");

  expect(result).toEqual([{ book_id: "allowed", reason: "เหตุผลที่ตรวจสอบแล้ว", source_ids: ["linked"] }]);
  expect(logUnknownId).toHaveBeenCalledWith("book_id", "wrong-group");
  expect(logUnknownId).toHaveBeenCalledWith("source_id", "mismatch");
});

test("withholds a reason when no verifiable citation remains", () => {
  expect(guardRecommendations([
    { book_id: "allowed", reason: "เหตุผล", source_ids: ["unlinked"] },
  ], [{ book: book("allowed", 1), source_ids: [] }], () => "เหตุผลที่ตรวจสอบแล้ว")).toEqual([{ book_id: "allowed", source_ids: [] }]);
});
