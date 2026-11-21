import "server-only";

import { searchBooks } from "@/lib/search/fuse";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Book, Catalog, Edition } from "@/types/generated";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import type { ChatMessageInput } from "./shared";
import { mentionsEdition, shelfEditionChoices, shelfEditionQuestion } from "./shelf-edition";

export const editionLabels: Record<Edition, string> = {
  manga: "มังงะ",
  light_novel: "ไลต์โนเวล",
  special_set: "ชุดพิเศษ",
  big_book: "บิ๊กบุ๊ก",
};

function bookNames(book: Book) {
  return [book.title, ...book.aliases].flatMap((name) => {
    const normalized = normalizeTitle(name);
    // Catalog aliases can include a translated title followed by a subtitle.
    const base = normalized.split(/\s+[~〜]\s*/u, 1)[0];
    return normalized === base ? [normalized] : [normalized, base];
  }).filter(Boolean);
}

export function createEditionClarifier(catalog: Catalog, history: readonly ChatMessageInput[]) {
  const hasEdition = mentionsEdition(history.at(-1)?.content ?? "");
  let choices: ReturnType<typeof shelfEditionChoices> | undefined;

  function clarifyRelatedEditions(anchor: Book | undefined, shelfUpdate = false): ChatAnswer | null {
    if (!anchor) return null;

    const names = new Set(bookNames(anchor));
    const related = catalog.books.filter((book) => book.series_id === anchor.series_id || bookNames(book).some((name) => names.has(name)));
    const editions = new Set(related.map(({ edition }) => edition));

    if (editions.size < 2) return null;

    const labels = (Object.keys(editionLabels) as Edition[])
      .filter((edition) => editions.has(edition))
      .map((edition) => editionLabels[edition]);

    if (shelfUpdate) {
      choices ??= shelfEditionChoices(new Set(catalog.books.flatMap(bookNames)), history);
      const aliases = new Set(related.flatMap(bookNames));
      const choice = choices.findLast(({ name }) => aliases.has(name));
      if (choice?.edition === anchor.edition) return null;
    }

    return {
      text: shelfUpdate
        ? shelfEditionQuestion(anchor.title, labels.join(" / "))
        : "พบเรื่องนี้หลายฉบับ คุณหมายถึงฉบับ" + labels.slice(0, -1).join(", ") + " หรือ" + labels.at(-1) + "คะ?",
      book_ids: [],
      source_ids: [],
      not_found: false,
      needs_clarification: true,
    };
  }

  return {
    forSearch(query: string) {
      if (hasEdition) return null;
      // Search without an edition so a model-selected edition cannot hide an alternative.
      return clarifyRelatedEditions(searchBooks(catalog.books, query, { limit: 1 })[0]);
    },
    forShelfItem(seriesId: string, edition: Edition) {
      return clarifyRelatedEditions(catalog.books.find((book) => book.series_id === seriesId && book.edition === edition), true);
    },
    forSeries(seriesId: string, edition: Edition) {
      if (hasEdition) return null;
      return clarifyRelatedEditions(catalog.books.find((book) => book.series_id === seriesId && book.edition === edition));
    },
  };
}
