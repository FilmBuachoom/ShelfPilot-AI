import Ajv from "ajv";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../../../schemas/extraction.schema.json";
import common from "../../../schemas/common.schema.json";
import { item, input } from "./fixtures";
import { normalizeItem, normalizeVolume } from "@/lib/ingest/normalize";
import { LlmUnavailableError, callStructured } from "@/lib/llm/client";
import { extractAnnouncement, extractionSchema } from "@/lib/ingest/extract";

vi.mock("@/lib/llm/client", async (original) => ({
  ...await original<typeof import("@/lib/llm/client")>(), callStructured: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());

test.each([["เล่ม ๑๓", 13], ["Vol. 7.5", 7.5], ["#๙", 9], [12, 12], [null, null], ["9-12", null], ["", null]])(
  "volume %s normalizes to %s", (raw, expected) => expect(normalizeVolume(raw)).toBe(expected),
);

test("uses Structured Outputs with a resolvable shared enum and normalizes the reply", async () => {
  vi.mocked(callStructured).mockResolvedValue({ data: { items: [item, { ...item, title: "fixture-b", volume: "Vol. 7.5" }] }, message: { role: "assistant", content: "", refusal: null } });
  const result = await extractAnnouncement(input);
  expect(result.items.map((item) => item.volume)).toEqual([13, 7.5]);
  const ajv = new Ajv({ strict: false }).addSchema(common);
  expect(ajv.validate(schema, result), ajv.errorsText()).toBe(true);
  expect(new Ajv({ strict: false }).compile(extractionSchema)(result)).toBe(true);
  const request = vi.mocked(callStructured).mock.calls[0][0];
  expect(request.schema).toEqual({ name: "extraction", schema: extractionSchema });
  expect(request.messages[1].content).not.toContain(input.source_url);
  expect(request.messages[0].content).toContain("untrusted source data");
});

test("declares explicit types for enums sent to strict Structured Outputs", async () => {
  vi.mocked(callStructured).mockResolvedValue({
    data: { items: [] },
    message: { role: "assistant", content: null, refusal: null },
  });

  await extractAnnouncement(input);

  expect(vi.mocked(callStructured).mock.calls[0][0].schema.schema).toMatchObject({
    properties: {
      items: {
        items: {
          properties: {
            release_date_precision: { type: ["string", "null"] },
            sale_status: { type: ["string", "null"] },
          },
        },
      },
    },
    $defs: { edition: { type: "string" } },
  });
});

test.each([null, "2026-10", "2026-10-01", "2026-10-19"])(
  "month precision drops any supplied day from %s", (release_date) => {
    expect(normalizeItem({ ...item, release_date, release_date_precision: "month" }, input.raw_text))
      .toMatchObject({ release_date: null, release_date_precision: "month" });
  },
);

test("invalid month-precision dates remain unknown", () => {
  expect(normalizeItem({ ...item, release_date: "2026-11-31", release_date_precision: "month" }, input.raw_text))
    .toMatchObject({ release_date: null, release_date_precision: "unknown" });
});

test.each(["2026-02-29", "2026-13-01", "tomorrow"])("invalid date %s becomes unknown", (release_date) => {
  expect(normalizeItem({ ...item, release_date }, input.raw_text))
    .toMatchObject({ release_date: null, release_date_precision: "unknown" });
});

test("absent or fabricated edition evidence never produces an edition", () => {
  for (const edition_evidence of [null, "นิยาย"]) {
    expect(normalizeItem({ ...item, edition_evidence }, input.raw_text))
      .toMatchObject({ edition: null, edition_evidence: null, edition_confidence: null });
  }
});

test("an unknown edition clears stray evidence and confidence", () => {
  expect(normalizeItem({ ...item, edition: null }, input.raw_text))
    .toMatchObject({ edition: null, edition_evidence: null, edition_confidence: null });
});

test("a refusal is surfaced as an unavailable extractor", async () => {
  vi.mocked(callStructured).mockResolvedValue({ data: null, message: { role: "assistant", content: null, refusal: "no" } });
  await expect(extractAnnouncement(input)).rejects.toBeInstanceOf(LlmUnavailableError);
});
