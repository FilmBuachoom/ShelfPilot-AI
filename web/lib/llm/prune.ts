import "server-only";

import type { Book } from "@/types/generated";

export function pruneBook(book: Book) {
  const { book_id, title, aliases, volume, edition, publisher, release_date, sale_status } = book;
  return { book_id, title, aliases, volume, edition, publisher, release_date, sale_status };
}
