import { expect, test, vi } from "vitest";
import { callStructured } from "@/lib/llm/client";
import { getRecommendations } from "@/lib/recommend/run";
import { book, catalog, shelf } from "../shelf-fixture";

vi.mock("@/lib/llm/client", () => ({ callStructured: vi.fn() }));

test("returns both code-only groups when the model times out and retries on the next request", async () => {
  const model = vi.mocked(callStructured);
  model.mockRejectedValueOnce(new Error("timed out")).mockResolvedValue({
    data: { continue: [], similar: [] },
    message: { role: "assistant", content: null, refusal: null },
  });
  const books = catalog(
    book("owned", 1),
    book("next", 2, { sale_status: "announced", store_url: "https://example.test/shop" }),
    book("similar", 1, { series_id: "other", cover_url: "https://example.test/cover.jpg" }),
  );
  const owned = shelf("owned");

  const result = await getRecommendations(books, owned);
  expect(result).toMatchObject({
    fallback: true,
    continue: [{ book_id: "next", source_ids: [] }],
    similar: [{ book_id: "similar", source_ids: [] }],
  });
  expect(result.continue[0]).not.toHaveProperty("reason");
  expect(result.similar[0]).not.toHaveProperty("reason");
  const request = JSON.stringify(model.mock.calls[0][0].messages);
  expect(request).not.toMatch(/store_url|cover_url|raw_text|example\.test/);

  expect(await getRecommendations(books, owned)).toMatchObject({ fallback: false });
  expect(model).toHaveBeenCalledTimes(2);
});

test("avoids the LLM when the catalog has no candidates", async () => {
  vi.mocked(callStructured).mockClear();
  expect(await getRecommendations(catalog(), shelf())).toMatchObject({
    fallback: false,
    continue: [],
    similar: [],
  });
  expect(callStructured).not.toHaveBeenCalled();
});
