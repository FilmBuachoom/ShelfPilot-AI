import { expect, test, vi } from "vitest";
import { createChatToolRegistry } from "@/lib/chat/tools/registry";
import type { Book, Catalog, UserShelf } from "@/types/generated";

const timestamp = "2026-11-21T00:00:00.000Z";

function book(overrides: Partial<Book> = {}): Book {
  return {
    book_id: "a-9",
    series_id: "series-a",
    title: "Alpha",
    aliases: ["อัลฟา", "アルファ"],
    volume: 9,
    edition: "manga",
    publisher: "Publisher A",
    release_date: "2026-11-18",
    release_date_precision: "day",
    sale_status: "announced",
    sources: ["source-a"],
    store_url: "https://example.test/store",
    cover_url: "https://example.test/cover",
    ...overrides,
  };
}

function fixtures(books: Book[], owned: string[] = []) {
  const catalog: Catalog = {
    books,
    sources: ["source-a", "source-b"].map((source_id) => ({
      source_id,
      source_url: "https://example.test/source",
      raw_text: "Synthetic announcement",
      publisher: "Publisher A",
      imported_at: timestamp,
    })),
    updated_at: timestamp,
  };
  const shelf: UserShelf = {
    owned: owned.map((book_id) => ({ book_id, added_at: timestamp })),
    updated_at: timestamp,
  };
  return { catalog, shelf };
}

test("filters by edition before limiting and prunes catalog fields", () => {
  const manga = Array.from({ length: 6 }, (_, i) => book({ book_id: `manga-${i}` }));
  const novel = book({ book_id: "novel", edition: "light_novel", sources: ["source-a", "missing"] });
  const { tools } = createChatToolRegistry(fixtures([...manga, novel]));

  const result = tools.search_catalog({ query: "アルファ", edition: "light_novel" });

  expect(result.groups).toEqual([{
    series_id: "series-a",
    edition: "light_novel",
    books: [{
      book_id: "novel",
      title: "Alpha",
      aliases: ["อัลฟา", "アルファ"],
      volume: 9,
      edition: "light_novel",
      publisher: "Publisher A",
      release_date: "2026-11-18",
      release_date_precision: "day",
      sale_status: "announced",
      source_ids: ["source-a"],
    }],
  }]);
  expect(tools.search_catalog({ query: "Alpha", edition: "manga" }).groups[0].books).toHaveLength(5);
});

test("matches release windows at day and month precision without exposing a placeholder day", () => {
  const { tools } = createChatToolRegistry(fixtures([
    book(),
    book({ book_id: "month", release_date: "2026-11-01", release_date_precision: "month" }),
    book({ book_id: "outside", release_date: "2026-11-19" }),
    book({ book_id: "undated", release_date: undefined }),
  ]));

  expect(tools.list_releases({ from: "2026-11-18", to: "2026-11-18" })).toMatchObject({
    books: [
      { book_id: "month", release_date: "2026-11" },
      { book_id: "a-9", release_date: "2026-11-18" },
    ],
    truncated: false,
  });
  expect(tools.list_releases({ from: "2026-02-30", to: "2026-11-18" })).toEqual({
    error: "invalid_date_range",
  });
});

test("allows only citations exposed in this turn and present in the catalog", () => {
  const context = fixtures([book(), book({ book_id: "a-10", volume: 10, release_date: undefined })]);
  const turn = createChatToolRegistry(context);
  const nextTurn = createChatToolRegistry(context);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  try {
    turn.tools.list_releases({ from: "2026-11-18", to: "2026-11-18" });
    expect(turn.guardCitations({
      book_ids: ["unknown", "a-10", "a-9", "a-9"],
      source_ids: ["source-b", "source-a", "source-a"],
    })).toEqual({ book_ids: ["a-9"], source_ids: ["source-a"] });
    expect(warn).toHaveBeenCalledExactlyOnceWith("Unknown catalog ID", {
      field: "book_id",
      id: "unknown",
    });
    expect(nextTurn.guardCitations({ book_ids: ["a-9"], source_ids: ["source-a"] }))
      .toEqual({ book_ids: [], source_ids: [] });
  } finally {
    warn.mockRestore();
  }
});

test("previews mixed shelf changes and leaves the catalog and shelf intact", () => {
  const alpha = [9, 10, 11, 12].map((volume) => book({ volume, book_id: `a-${volume}` }));
  const beta = book({ book_id: "b-14", series_id: "series-b", title: "Beta", aliases: [], volume: 14 });
  const context = fixtures([...alpha, beta], ["a-9", "b-14"]);
  const before = structuredClone(context);
  const turn = createChatToolRegistry(context);

  const result = turn.tools.propose_shelf_update({
    user_text: "Add Alpha 9–13 and remove Beta 14–15",
    items: [
      { title_query: "อัลฟา", volumes: "๙–๑๓", action: "add" },
      { title_query: "Alpha", volumes: "12", action: "add" },
      { title_query: "Beta", volumes: "14–15", action: "remove" },
    ],
  });

  expect(result).toMatchObject({
    status: "proposal",
    items: [
      { series_id: "series-a", add: ["a-10", "a-11", "a-12"], already_owned: [9], not_found_volumes: [13] },
      { series_id: "series-b", remove: ["b-14"], not_found_volumes: [15] },
    ],
    total: 4,
  });
  expect(turn.guardCitations({ book_ids: ["a-9", "a-10"], source_ids: ["source-a"] }))
    .toEqual({ book_ids: ["a-10"], source_ids: [] });
  expect(context).toEqual(before);
});

test("requires clarification for ambiguous editions, fuzzy-only matches, and conflicting actions", () => {
  const { tools } = createChatToolRegistry(fixtures([
    book(),
    book({ book_id: "novel", edition: "light_novel" }),
  ]));
  const intent = { title_query: "Alpha", volumes: "9", action: "add" } as const;

  expect(tools.propose_shelf_update({ user_text: "Add Alpha 9", items: [intent] })).toMatchObject({
    status: "needs_clarification",
    reason: "ambiguous_title",
    options: [{ edition: "manga" }, { edition: "light_novel" }],
  });
  expect(tools.propose_shelf_update({
    user_text: "Add Alpa 9",
    items: [{ ...intent, title_query: "Alpa", edition: "manga" }],
  })).toMatchObject({ status: "needs_clarification", reason: "ambiguous_title" });
  const mangaIntent = { ...intent, edition: "manga" } as const;
  expect(tools.propose_shelf_update({ user_text: "Add Alpha manga 9", items: [mangaIntent] }))
    .toMatchObject({ status: "proposal", items: [{ add: ["a-9"] }] });
  expect(tools.propose_shelf_update({
    user_text: "Add and remove Alpha manga 9",
    items: [mangaIntent, { ...mangaIntent, action: "remove" }],
  })).toMatchObject({ status: "needs_clarification", reason: "conflicting_actions", volume: 9 });
});
