import "server-only";

import { readCatalog, readReviewQueue, updateJsonAtomic } from "@/lib/data/store";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Catalog } from "@/types/generated";
import { createReviewedBook, mergeReviewedBook } from "./apply";
import type { ReviewResolution } from "./contracts";
import { findCompletedReviewSource, withReviewWrite } from "./review-queue";
import {
  canCreateFromReview, parseReviewResolution, pendingReviewResolution, reviewDraft, type ReviewItem,
} from "./review-record";

export class ReviewResolutionError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
  }
}

function chosenBook(catalog: Catalog, record: ReviewItem, bookId: string, volume: number | null) {
  const option = record.candidates.find(({ book_id }) => book_id === bookId);
  const target = catalog.books.find(({ book_id }) => book_id === option?.book_id);
  if (!target || target.edition !== option?.edition || (volume !== null && target.volume !== volume)) {
    throw new ReviewResolutionError("ตัวเลือกนี้ไม่ตรงกับรายการในคิวแล้ว", 409);
  }
  return target;
}

function applyApproval(
  catalog: Catalog,
  record: ReviewItem,
  resolution: Exclude<ReviewResolution, { action: "skip" }>,
  resuming: boolean,
): { catalog: Catalog; referenceBookId?: string } {
  const draft = reviewDraft(record);
  if (!draft) throw new ReviewResolutionError("รายการนี้ไม่มีข้อมูลประกาศสำหรับอนุมัติ", 409);
  const { extracted, source } = draft;

  if (resolution.action === "merge") {
    const target = chosenBook(catalog, record, resolution.book_id, extracted.volume);
    return { catalog: mergeReviewedBook(catalog, source, extracted, target) };
  }

  const { title, volume } = extracted;
  if (!canCreateFromReview(record) || !title || volume === null) {
    throw new ReviewResolutionError("ต้องมีชื่อเรื่อง เลขเล่ม และสำนักพิมพ์ก่อนสร้างรายการใหม่", 409);
  }
  const reference = resolution.book_id
    ? chosenBook(catalog, record, resolution.book_id, volume)
    : resuming
      ? catalog.books.find(({ book_id }) => book_id === record.extracted.resolution_reference_book_id)
      : inferPublicationLine(catalog, record, title);
  if (resuming && record.extracted.resolution_reference_book_id && !reference) {
    throw new ReviewResolutionError("เล่มอ้างอิงสำหรับการอนุมัติเดิมไม่มีอยู่ในแค็ตตาล็อกแล้ว", 409);
  }
  const updated = createReviewedBook(
    catalog, source, { ...extracted, title, volume, edition: resolution.edition },
    extracted.publisher || source.publisher, reference,
  );
  if (!updated) throw new ReviewResolutionError("มีเล่มฉบับนี้อยู่แล้ว กรุณาเลือกตรวจและรวม", 409);
  return { catalog: updated, referenceBookId: reference?.book_id };
}

function inferPublicationLine(catalog: Catalog, record: ReviewItem, title: string) {
  const candidateIds = new Set(record.candidates.map(({ book_id }) => book_id));
  const candidates = catalog.books.filter(({ book_id }) => candidateIds.has(book_id));
  if (!candidates.length && candidateIds.size) {
    throw new ReviewResolutionError("ตัวเลือกในคิวไม่มีอยู่ในแค็ตตาล็อกแล้ว", 409);
  }
  const normalizedTitle = normalizeTitle(title);
  const books = candidates.length ? candidates : catalog.books.filter((book) =>
    [book.title, ...book.aliases].some((name) => normalizeTitle(name) === normalizedTitle));
  if (new Set(books.map(({ series_id }) => series_id)).size > 1) {
    throw new ReviewResolutionError("กรุณาเลือกเล่มอ้างอิงเพื่อระบุสายพิมพ์ก่อนสร้างรายการใหม่", 409);
  }
  return books[0];
}

export function resolveReview(resolution: ReviewResolution) {
  return withReviewWrite(async () => {
    const queue = await readReviewQueue();
    const item = queue.items.find(({ review_id }) => review_id === resolution.review_id);
    if (!item) throw new ReviewResolutionError("ไม่พบรายการตรวจสอบ", 404);
    if (item.status === "resolved") return;

    const previous = pendingReviewResolution(item);
    if (previous && JSON.stringify(previous) !== JSON.stringify(parseReviewResolution(resolution))) {
      throw new ReviewResolutionError("รายการนี้มีการอนุมัติค้างอยู่ กรุณาบันทึกการอนุมัติเดิมให้เสร็จ", 409);
    }
    if (resolution.action !== "skip") {
      const catalog = await readCatalog();
      const records = queue.items.filter(({ source_id }) => source_id === item.source_id);
      if (typeof item.extracted.item_count === "number" && !findCompletedReviewSource(records)
        && !catalog.sources.some(({ source_id }) => source_id === item.source_id)) {
        throw new ReviewResolutionError("การนำเข้าประกาศยังไม่เสร็จ กรุณาส่งประกาศเดิมอีกครั้ง", 409);
      }
      const { catalog: updated, referenceBookId } = applyApproval(catalog, item, resolution, !!previous);
      if (!previous) {
        // Record the validated choice before writing the catalog so retries can only complete that choice.
        await updateJsonAtomic("review_queue.json", (current) => ({
          items: current.items.map((record) => record.review_id === item.review_id
            ? { ...record, extracted: { ...record.extracted, resolution, resolution_reference_book_id: referenceBookId } }
            : record),
        }));
      }
      if (updated !== catalog) await updateJsonAtomic("catalog.json", () => updated);
    }
    await updateJsonAtomic("review_queue.json", (current) => ({
      items: current.items.map((record) => record.review_id === item.review_id
        ? { ...record, status: "resolved" } : record),
    }));
  });
}
