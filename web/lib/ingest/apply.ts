import "server-only";

import { createHash } from "node:crypto";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Book, Catalog, Edition, Source } from "@/types/generated";
import type { IngestContext, MatchDecision, NormalizedItem } from "./contracts";
import { decideMatchStatus } from "./decide";
import { getItemEditionReview } from "./edition-review";
import type { CatalogMatch } from "./match";

const saleOrder: Record<Book["sale_status"], number> = { announced: 0, preorder: 1, released: 2 };

function hash(parts: readonly (string | number)[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 12);
}

function learnAlias(title: string, aliases: string[], extractedTitle: string): string[] {
  const normalized = normalizeTitle(extractedTitle);
  const known = [title, ...aliases].some((name) => normalizeTitle(name) === normalized);
  return known ? aliases : [...aliases, extractedTitle];
}

function mergeBook(book: Book, item: NormalizedItem, sourceId: string): Book {
  const releaseDate = item.release_date_precision === "day"
    && (!book.release_date || book.release_date_precision === "month") ? item.release_date : null;
  const saleStatus = item.sale_status && saleOrder[item.sale_status] > saleOrder[book.sale_status]
    ? item.sale_status : book.sale_status;

  return {
    ...book,
    ...(releaseDate && { release_date: releaseDate, release_date_precision: "day" }),
    aliases: item.title ? learnAlias(book.title, book.aliases, item.title) : book.aliases,
    sale_status: saleStatus,
    sources: book.sources.includes(sourceId) ? book.sources : [...book.sources, sourceId],
  };
}

function newBook(
  item: NormalizedItem & { title: string; volume: number; edition: Edition },
  publisher: string,
  sourceId: string,
  seriesId: string,
  candidate: Book | undefined,
): Book {
  const title = candidate?.title ?? item.title;
  return {
    book_id: `bk_${hash([seriesId, item.edition, item.volume])}`,
    series_id: seriesId,
    title,
    aliases: learnAlias(title, candidate?.aliases ?? [], item.title),
    volume: item.volume,
    edition: item.edition,
    publisher,
    ...(item.release_date && { release_date: item.release_date }),
    // The optional date stays absent when no day can be represented.
    release_date_precision: item.release_date_precision === "day" ? "day" : "month",
    sale_status: item.sale_status ?? "announced",
    sources: [sourceId],
  };
}

function withSource(catalog: Catalog, books: Book[], source: Source, updatedAt = source.imported_at): Catalog {
  return {
    books,
    sources: catalog.sources.some(({ source_id }) => source_id === source.source_id)
      ? catalog.sources : [...catalog.sources, source],
    updated_at: updatedAt,
  };
}

export function mergeReviewedBook(catalog: Catalog, source: Source, item: NormalizedItem, target: Book): Catalog {
  if (target.sources.includes(source.source_id)) return catalog;
  const books = catalog.books.map((book) => book === target ? mergeBook(book, item, source.source_id) : book);
  return withSource(catalog, books, source, new Date().toISOString());
}

export function createReviewedBook(
  catalog: Catalog,
  source: Source,
  item: NormalizedItem & { title: string; volume: number; edition: Edition },
  publisher: string,
  candidate?: Book,
): Catalog | null {
  const seriesId = candidate?.series_id ?? `sr_${hash([normalizeTitle(item.title)])}`;
  const existing = catalog.books.find((book) => book.series_id === seriesId && book.volume === item.volume && book.edition === item.edition);
  if (existing) return existing.sources.includes(source.source_id) ? catalog : null;
  const added = newBook(item, publisher, source.source_id, seriesId, candidate);
  return withSource(catalog, [...catalog.books, added], source, new Date().toISOString());
}

export function applyMatches(
  catalog: Catalog,
  context: IngestContext,
  matches: readonly (CatalogMatch | null)[],
  previouslyQueued: ReadonlyMap<number, MatchDecision> = new Map(),
) {
  const { source, extraction } = context;
  if (catalog.sources.some(({ source_id }) => source_id === source.source_id)) {
    return { catalog, decisions: [] };
  }

  const books = [...catalog.books];
  let changed = false;
  const decisions = extraction.items.map((item, index): MatchDecision => {
    const queued = previouslyQueued.get(index);
    if (queued) return queued;
    const match = matches[index] ?? null;
    const candidate = books.find(({ book_id }) => book_id === match?.candidate_book_id);
    const { title, volume, edition } = item;
    const result = {
      candidate_book_id: candidate?.book_id ?? null,
      matched_alias: match?.matched_alias ?? null,
    };

    const review = getItemEditionReview(item, extraction.items, source.raw_text, match?.edition_confidence);
    if (review) return { ...result, match_status: review.status, reason: review.reason };

    const status = decideMatchStatus(item, match, candidate);
    if (!title || volume === null || !edition) {
      return { ...result, match_status: "needs_review", reason: "ต้องยืนยันชื่อเรื่อง เลขเล่ม และฉบับพิมพ์จากประกาศ" };
    }
    if (status === "needs_review") {
      return { ...result, match_status: status, reason: match?.reason || "ยังยืนยันหนังสือที่ตรงกับประกาศไม่ได้" };
    }

    const seriesId = candidate?.series_id ?? `sr_${hash([normalizeTitle(title)])}`;
    // Recheck against the latest catalog to handle another request adding this edition first.
    const existing = candidate?.edition === edition ? books.indexOf(candidate) : books.findIndex(
      (book) => book.series_id === seriesId && book.volume === volume && book.edition === edition,
    );
    if (existing !== -1) {
      const book = books[existing];
      books[existing] = mergeBook(book, item, source.source_id);
      changed = true;
      return {
        ...result,
        match_status: "duplicate_merged",
        candidate_book_id: book.book_id,
        matched_alias: candidate?.book_id === book.book_id ? result.matched_alias : null,
        reason: candidate?.book_id === book.book_id && match?.reason
          ? match.reason : "พบชื่อเรื่อง เลขเล่ม และฉบับพิมพ์เดียวกันในแค็ตตาล็อก",
      };
    }

    const publisher = item.publisher ?? source.publisher;
    if (!publisher) {
      return { ...result, match_status: "needs_review", reason: "ต้องยืนยันสำนักพิมพ์ก่อนเพิ่มหนังสือ" };
    }
    books.push(newBook({ ...item, title, volume, edition }, publisher, source.source_id, seriesId, candidate));
    changed = true;
    return {
      ...result,
      match_status: "distinct_edition",
      reason: candidate ? match?.reason || "พบเรื่องและเล่มเดิม แต่เป็นคนละฉบับพิมพ์" : "เพิ่มหนังสือใหม่ในแค็ตตาล็อก",
    };
  });

  return {
    decisions,
    catalog: changed
      ? withSource(catalog, books, source)
      : catalog,
  };
}
