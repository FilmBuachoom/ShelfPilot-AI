import "server-only";

import { searchBooks } from "@/lib/search/fuse";
import { normalizeTitle } from "@/lib/search/normalize";
import { parseVolumeSpec } from "@/lib/shelf/volumes";
import type { Book, Catalog, Edition, UserShelf } from "@/types/generated";
import type { ShelfProposal, ShelfProposalItem } from "@/types/generated/chat-answer";

interface ShelfIntent {
  title_query: string;
  edition?: Edition;
  volumes: string;
  action: "add" | "remove";
}

export interface ProposeShelfUpdateArgs {
  items: readonly ShelfIntent[];
  user_text: string;
}

interface SeriesOption {
  series_id: string;
  edition: Edition;
  title: string;
}

type ClarificationReason =
  | "empty_request"
  | "invalid_volumes"
  | "title_not_found"
  | "ambiguous_title"
  | "ambiguous_volume"
  | "conflicting_actions";

type ProposalResult =
  | ({ status: "proposal" } & ShelfProposal)
  | { status: "needs_clarification"; reason: ClarificationReason; title_query?: string;
      options?: SeriesOption[]; volume?: number };

interface PendingItem {
  booksByVolume: Map<number, Book[]>;
  requested: Map<number, ShelfIntent["action"]>;
  titleQuery: string;
  seriesId: string;
  edition: Edition;
}

export function proposeShelfUpdate(
  catalog: Catalog,
  shelf: UserShelf,
  { items, user_text }: ProposeShelfUpdateArgs,
): ProposalResult {
  if (items.length === 0) return clarify("empty_request");
  const pendingItems = new Map<string, PendingItem>();

  for (const { title_query, edition, volumes, action } of items) {
    const parsed = parseVolumeSpec(volumes);
    if (parsed === null) return clarify("invalid_volumes", { title_query });

    const exactOptions = findExactOptions(catalog.books, title_query, edition);
    const [option] = exactOptions;
    if (exactOptions.length > 1) {
      return clarify("ambiguous_title", { title_query, options: exactOptions });
    }
    if (!option) {
      // A fuzzy hit can suggest a clarification, but a partial match alone
      // cannot identify the edition the user intends to add or remove.
      const options = seriesOptions(searchBooks(catalog.books, title_query, { edition }));
      return clarify(options.length ? "ambiguous_title" : "title_not_found", { title_query, options });
    }

    const key = JSON.stringify([option.series_id, option.edition]);
    let pending = pendingItems.get(key);
    if (!pending) {
      pending = {
        booksByVolume: indexVolumes(catalog.books, option),
        requested: new Map(),
        titleQuery: title_query,
        seriesId: option.series_id,
        edition: option.edition,
      };
      pendingItems.set(key, pending);
    }
    for (const volume of parsed) {
      const prior = pending.requested.get(volume);
      if (prior && prior !== action) return clarify("conflicting_actions", { title_query, volume });
      pending.requested.set(volume, action);
    }
  }

  const owned = new Set(shelf.owned.map(({ book_id }) => book_id));
  const preview: ShelfProposalItem[] = [];
  let total = 0;
  for (const { booksByVolume, requested, titleQuery, seriesId, edition } of pendingItems.values()) {
    const item: ShelfProposalItem = {
      series_id: seriesId,
      edition,
      add: [],
      remove: [],
      already_owned: [],
      not_owned: [],
      not_found_volumes: [],
    };
    for (const [volume, action] of requested) {
      const matches = booksByVolume.get(volume) ?? [];
      if (matches.length > 1) return clarify("ambiguous_volume", { title_query: titleQuery, volume });
      const [book] = matches;
      if (!book) {
        item.not_found_volumes.push(volume);
      } else if (action === "add") {
        if (owned.has(book.book_id)) item.already_owned.push(volume);
        else item.add.push(book.book_id);
      } else {
        if (owned.has(book.book_id)) item.remove.push(book.book_id);
        else item.not_owned.push(volume);
      }
    }
    preview.push(item);
    total += item.add.length + item.remove.length;
  }
  return { status: "proposal", items: preview, user_text, total };
}

function clarify(
  reason: ClarificationReason,
  details?: { title_query?: string; options?: SeriesOption[]; volume?: number },
): ProposalResult {
  return { status: "needs_clarification", reason, ...details };
}

function findExactOptions(books: readonly Book[], titleQuery: string, edition?: Edition) {
  const query = normalizeTitle(titleQuery);
  if (!query) return [];
  return seriesOptions(books.filter((book) =>
    (!edition || book.edition === edition)
    && [book.title, ...book.aliases].some((name) => normalizeTitle(name) === query),
  ));
}

function seriesOptions(books: readonly Book[]): SeriesOption[] {
  const options = new Map<string, SeriesOption>();
  for (const { series_id, edition, title } of books) {
    const key = JSON.stringify([series_id, edition]);
    if (!options.has(key)) options.set(key, { series_id, edition, title });
  }
  return [...options.values()];
}

function indexVolumes(books: readonly Book[], option: SeriesOption): Map<number, Book[]> {
  const volumes = new Map<number, Book[]>();
  for (const book of books) {
    if (book.series_id !== option.series_id || book.edition !== option.edition) continue;
    const matches = volumes.get(book.volume);
    if (matches) matches.push(book);
    else volumes.set(book.volume, [book]);
  }
  return volumes;
}
