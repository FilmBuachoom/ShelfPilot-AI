import { expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/recommend/route";
import { readCatalog, readShelf } from "@/lib/data/store";
import { callStructured } from "@/lib/llm/client";
import { book, catalog, shelf, timestamp } from "../shelf-fixture";

vi.mock("@/lib/data/store", () => ({ readCatalog: vi.fn(), readShelf: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ callStructured: vi.fn() }));

function refresh(body: unknown) {
  return POST(new Request("http://localhost/api/recommend", { method: "POST", body: JSON.stringify(body) }));
}

test("coalesces GETs and keys by sorted owned IDs, catalog timestamp and size", async () => {
  const model = vi.mocked(callStructured);
  model.mockResolvedValue({
    data: { continue: [], similar: [] },
    message: { role: "assistant", content: null, refusal: null },
  });
  const owned = vi.mocked(readShelf);
  const read = vi.mocked(readCatalog);
  const input = catalog(book("first", 1), book("second", 2), book("third", 3));
  read.mockResolvedValue(input);
  owned.mockResolvedValue(shelf("first", "second"));

  const [one, two] = await Promise.all([GET(), GET()]);
  expect(await one.json()).toEqual(await two.json());
  expect(one.headers.get("Cache-Control")).toBe("no-store");
  expect(model).toHaveBeenCalledTimes(1);

  owned.mockResolvedValue(shelf("second", "first"));
  expect((await GET()).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(1);

  owned.mockResolvedValue(shelf("second"));
  expect((await GET()).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(2);

  read.mockResolvedValue({ ...input, updated_at: "2026-11-22T00:00:00+07:00" });
  expect((await GET()).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(3);

  read.mockResolvedValue({ ...input, books: [...input.books, book("fourth", 4)] });
  expect((await GET()).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(4);

  expect((await refresh({ refresh: false })).status).toBe(400);
  expect(model).toHaveBeenCalledTimes(4);
  expect((await refresh({ refresh: true })).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(5);
  expect((await GET()).ok).toBe(true);
  expect(model).toHaveBeenCalledTimes(5);
});

test("returns a cited reason using the structured model output", async () => {
  const source = {
    source_id: "verified",
    source_url: "https://example.test/announcement",
    raw_text: "ข้อความสำหรับตรวจข้อมูลที่ส่งให้โมเดล",
    publisher: "สำนักพิมพ์ทดสอบ",
    imported_at: "2026-11-21T00:00:00+07:00",
  };
  const item = { book_id: "next", source_ids: [source.source_id], reason: "เล่มถัดไปมีประกาศแล้ว" };
  const model = vi.mocked(callStructured);
  model.mockResolvedValue({
    data: { continue: [item], similar: [] },
    message: { role: "assistant", content: null, refusal: null },
  });
  vi.mocked(readShelf).mockResolvedValue(shelf("owned"));
  vi.mocked(readCatalog).mockResolvedValue({
    ...catalog(book("owned", 1), book("next", 2, { sale_status: "announced", sources: [source.source_id] })),
    sources: [source],
  });

  expect(await (await GET()).json()).toMatchObject({ fallback: false, continue: [{ ...item, reason: "เล่ม 2 ที่มีประกาศในชุดที่คุณสะสม" }] });
  const [input] = model.mock.lastCall!;
  expect(input.schema).toMatchObject({ name: "recommendation" });
  expect(input).toMatchObject({ timeoutMs: 30_000, maxRetries: 0, maxCompletionTokens: 2_000 });
  expect(JSON.parse(input.messages[1].content as string)).toMatchObject({
    shelf: [{ owned_count: 1 }],
    continue: [{ book_id: "next", status: "upcoming", source_ids: ["verified"] }],
  });
  expect(JSON.stringify(input.messages)).not.toContain(source.raw_text);
});

test("replaces invented model reasons with verified shelf facts", async () => {
  const source = { source_id: "verified-2", source_url: "https://example.test", raw_text: "fixture", publisher: "Animag", imported_at: timestamp };
  const owned = book("owned-novel", 1, { title: "หมอยา", edition: "light_novel", publisher: "Phoenix" });
  const matchingEdition = book("same-edition", 1, { title: "เรื่องใหม่", series_id: "other-1", edition: "light_novel", publisher: "Animag", sources: [source.source_id] });
  const noMatch = book("unrelated", 1, { title: "อีกเรื่อง", series_id: "other-2", edition: "manga", publisher: "Animag", sources: [source.source_id] });
  vi.mocked(readShelf).mockResolvedValue(shelf(owned.book_id));
  vi.mocked(readCatalog).mockResolvedValue({ ...catalog(owned, matchingEdition, noMatch), sources: [source] });
  vi.mocked(callStructured).mockResolvedValue({
    data: { continue: [], similar: [
      { book_id: matchingEdition.book_id, reason: "สำนักพิมพ์ Animag เหมือนหมอยาในคลัง", source_ids: [source.source_id] },
      { book_id: noMatch.book_id, reason: "มังงะ Animag เหมือนหมอยาในคลัง", source_ids: [source.source_id] },
    ] }, message: { role: "assistant", content: null, refusal: null },
  });

  const result = await (await refresh({ refresh: true })).json();
  expect(result.similar).toEqual([{ book_id: "same-edition", reason: "ฉบับไลต์โนเวล เช่นเดียวกับ หมอยา ในคลังของคุณ", source_ids: ["verified-2"] }]);
  const payload = JSON.parse(vi.mocked(callStructured).mock.lastCall![0].messages[1].content as string);
  expect(payload.similar.map((entry: { book_id: string }) => entry.book_id)).toEqual(["same-edition"]);
});
