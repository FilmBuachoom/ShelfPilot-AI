import { expect, test } from "vitest";
import { createSourceId } from "@/lib/ingest/source-id";

test("source IDs normalize whitespace but retain distinct evidence and URL", () => {
  const id = createSourceId("fixture-a\n เล่ม ๑๓", "https://example.test/a");
  expect(id).toMatch(/^src_[a-f0-9]{12}$/);
  expect(createSourceId(" fixture-a  เล่ม ๑๓ ", "https://example.test/a")).toBe(id);
  expect(createSourceId("fixture-a เล่ม ๑๓", "https://example.test/b")).not.toBe(id);
  expect(createSourceId("fixture-a เล่ม ๑๔", "https://example.test/a")).not.toBe(id);
});
