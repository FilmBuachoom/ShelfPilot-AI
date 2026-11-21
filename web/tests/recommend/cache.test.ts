import { expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/recommend/route";
import { readCatalog, readShelf } from "@/lib/data/store";
import { callStructured } from "@/lib/llm/client";
import { book, catalog, shelf } from "../shelf-fixture";

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
    ...catalog(book("owned", 1), book("next", 2, {
      sale_status: "announced",
      release_date: "2026-08-01",
      release_date_precision: "month",
      sources: [source.source_id],
    })),
    sources: [source],
  });

  expect(await (await GET()).json()).toMatchObject({ fallback: false, continue: [item] });
  const [input] = model.mock.lastCall!;
  expect(input.schema).toMatchObject({ name: "recommendation" });
  expect(input).toMatchObject({ timeoutMs: 20_000, maxRetries: 0 });
  expect(JSON.parse(input.messages[1].content as string)).toMatchObject({
    shelf: [{ owned_count: 1 }],
    continue: [{ book_id: "next", status: "upcoming", release_date: "2026-08", source_ids: ["verified"] }],
  });
  expect(JSON.stringify(input.messages)).not.toContain(source.raw_text);
});
