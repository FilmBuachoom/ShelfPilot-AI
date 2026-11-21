import { expect, test } from "vitest";
import { normalizeTitle } from "@/lib/search/normalize";

test.each([
  ["๐๑๒๓๔๕๖๗๘๙", "0123456789"],
  ["เล่ม 9", "9"],
  ["Vol.9", "9"],
  ["  Mixed\t Case\n #๙  ", "mixed case 9"],
  ["ชื่อเล่ม๙", "ชื่อ 9"],
  ["เล่มโปรด", "เล่มโปรด"],
])("normalizes %s to %s", (input, expected) => {
  expect(normalizeTitle(input)).toBe(expected);
});
