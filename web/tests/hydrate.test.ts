import { afterEach, expect, test, vi } from "vitest";
import { getBook, getSource } from "@/lib/data/hydrate";

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
  ["book_id", getBook],
  ["source_id", getSource],
] as const)("returns null and logs an unknown %s once", async (field, lookup) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  await expect(lookup("unknown-id")).resolves.toBeNull();
  expect(warn).toHaveBeenCalledExactlyOnceWith("Unknown catalog ID", { field, id: "unknown-id" });
});
