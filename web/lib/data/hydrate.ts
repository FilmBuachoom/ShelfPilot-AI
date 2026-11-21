import "server-only";

import type { Book, BookId, Source, SourceId } from "@/types/generated";
import { readCatalog } from "./store";

export function logUnknownId(field: "book_id" | "source_id", id: string): void {
  console.warn("Unknown catalog ID", { field, id });
}

export async function getBook(id: BookId): Promise<Book | null> {
  const { books } = await readCatalog();
  const book = books.find((entry) => entry.book_id === id);
  if (book === undefined) {
    logUnknownId("book_id", id);
  }
  return book ?? null;
}

export async function getSource(id: SourceId): Promise<Source | null> {
  const { sources } = await readCatalog();
  const source = sources.find((entry) => entry.source_id === id);
  if (source === undefined) {
    logUnknownId("source_id", id);
  }
  return source ?? null;
}
