import { expect, test } from "vitest";
import { parseVolumeSpec } from "@/lib/shelf/volumes";

test.each([
  ["9-12", [9, 10, 11, 12]],
  ["9–12", [9, 10, 11, 12]],
  ["๙-๑๒", [9, 10, 11, 12]],
  ["เล่ม 14", [14]],
  ["เล่ม๑๔", [14]],
  ["เล่ม ๗.๕", [7.5]],
  ["1,3,5-6,6", [1, 3, 5, 6]],
  ["9007199254740990-9007199254740991", [9007199254740990, 9007199254740991]],
])("parses %s", (input, expected) => {
  expect(parseVolumeSpec(input)).toEqual(expected);
});

test.each(["", "9-", "5-3", "3,,5", "-1", "1-101", "7.5-9", "1-100,102", "9007199254740992"])(
  "rejects invalid or oversized input %s",
  (input) => expect(parseVolumeSpec(input)).toBeNull(),
);
