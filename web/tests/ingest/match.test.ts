import Ajv from "ajv";
import { afterEach, expect, test, vi } from "vitest";
import schema from "../../../schemas/match_result.schema.json";
import common from "../../../schemas/common.schema.json";
import { matchAnnouncement, matchResultSchema, matchTitle } from "@/lib/ingest/match";
import { normalizeItem } from "@/lib/ingest/normalize";
import { callStructured } from "@/lib/llm/client";
import { readCatalog } from "@/lib/data/store";
import { book, catalog } from "../shelf-fixture";
import { input, item, matchResult } from "./fixtures";

vi.mock("@/lib/data/store", () => ({ readCatalog: vi.fn() }));
vi.mock("@/lib/llm/client", async (original) => ({
  ...await original<typeof import("@/lib/llm/client")>(), callStructured: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

const sameVolume = book("bk_target", 13, {
  aliases: ["テスト", "Tesuto", "ชุดฯ"],
  sources: ["src_private"],
  release_date: "2026-10-02",
  store_url: "https://example.test/shop",
  cover_url: "https://example.test/cover",
});
const normalized = normalizeItem({ ...item, title: sameVolume.title }, input.raw_text);

function reply(data: unknown) {
  vi.mocked(callStructured).mockResolvedValue({ data, message: { role: "assistant", content: null, refusal: null } });
}

test("shortlists five pruned books, putting the same volume first", async () => {
  reply(matchResult);
  const books = [...Array.from({ length: 12 }, (_, index) => book(`bk_${index}`, index)), sameVolume];
  await matchAnnouncement(normalized, books);

  const request = vi.mocked(callStructured).mock.calls[0][0];
  expect(request.schema).toEqual({ name: "match_result", schema: matchResultSchema });
  const payload = JSON.parse(String(request.messages[1].content));
  expect(payload.candidates).toHaveLength(5);
  expect(payload.candidates[0]).toEqual({
    book_id: sameVolume.book_id, title: sameVolume.title, aliases: sameVolume.aliases,
    volume: sameVolume.volume, edition: sameVolume.edition, publisher: sameVolume.publisher,
  });
  expect(vi.mocked(readCatalog)).not.toHaveBeenCalled();
  expect(new Ajv({ strict: false }).addSchema(common).validate(schema, matchResult)).toBe(true);
  expect(new Ajv({ strict: false }).compile(matchResultSchema)(matchResult)).toBe(true);
});

test.each(["ชุดทดสอบ", "テスト", "Tesuto", "ชุดฯ"])("finds the same book through %s", async (title) => {
  vi.mocked(readCatalog).mockResolvedValue(catalog(sameVolume));
  reply({ ...matchResult, matched_alias: title, edition: null, edition_confidence: 0, same_volume: false });
  const result = await matchTitle(title);
  const { candidates } = JSON.parse(String(vi.mocked(callStructured).mock.calls[0][0].messages[1].content));
  expect(candidates.map(({ book_id }: { book_id: string }) => book_id)).toEqual([sameVolume.book_id]);
  expect(result?.candidate_book_id).toBe(sameVolume.book_id);
  expect(result?.matched_alias).toBe(title === sameVolume.title ? null : title);
});

test("rejects an ID outside the shortlisted books", async () => {
  reply({ ...matchResult, candidate_book_id: "bk_invented", matched_alias: "wrong" });
  await expect(matchAnnouncement(normalized, [sameVolume])).resolves.toMatchObject({
    candidate_book_id: null, matched_alias: null, rejectedCandidate: true,
  });
});

test("skips OpenAI when Fuse finds no candidates", async () => {
  await expect(matchAnnouncement({ ...normalized, title: "別の作品" }, [sameVolume])).resolves.toBeNull();
  expect(callStructured).not.toHaveBeenCalled();
});
