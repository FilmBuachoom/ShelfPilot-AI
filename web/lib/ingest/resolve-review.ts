import "server-only";

import type { Book, Catalog } from "@/types/generated";
import { createReviewedBook, mergeReviewedBook } from "./apply";
import type { ReviewResolution } from "./contracts";
import { findCompletedReviewSource } from "./review-queue";
import { withIngestWrite, type UpdateReviewQueue } from "./storage";
import {
  canCreateFromReview, parseReviewResolution, pendingReviewResolution, reviewDraft, reviewPublicationBooks, type ReviewItem,
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
): { catalog: Catalog | null; referenceBookId?: string } {
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
  const relatedBooks = reviewPublicationBooks(catalog.books, record);
  const reference = creationReference(catalog, relatedBooks, record, resolution.book_id, resuming);
  const updated = createReviewedBook(
    catalog, source, { ...extracted, title, volume, edition: resolution.edition },
    extracted.publisher || source.publisher, { reference, relatedBooks, resuming },
  );
  return { catalog: updated, referenceBookId: reference?.book_id };
}

function creationReference(
  catalog: Catalog,
  relatedBooks: readonly Book[],
  record: ReviewItem,
  selectedBookId: string | undefined,
  resuming: boolean,
) {
  if (resuming) {
    const referenceId = record.extracted.resolution_reference_book_id;
    if (typeof referenceId !== "string") return;
    const reference = catalog.books.find(({ book_id }) => book_id === referenceId);
    if (!reference) throw new ReviewResolutionError("เล่มอ้างอิงสำหรับการอนุมัติเดิมไม่มีอยู่ในแค็ตตาล็อกแล้ว", 409);
    return reference;
  }
  if (selectedBookId) {
    const reference = relatedBooks.find(({ book_id }) => book_id === selectedBookId);
    if (!reference) throw new ReviewResolutionError("เล่มอ้างอิงนี้ไม่อยู่ในสายพิมพ์ที่เกี่ยวข้อง", 409);
    return reference;
  }
  if (new Set(relatedBooks.map(({ series_id }) => series_id)).size > 1) {
    throw new ReviewResolutionError("กรุณาเลือกเล่มอ้างอิงเพื่อระบุสายพิมพ์ก่อนสร้างรายการใหม่", 409);
  }
  if (!relatedBooks.length && record.candidates.length) {
    throw new ReviewResolutionError("ตัวเลือกในคิวไม่มีอยู่ในแค็ตตาล็อกแล้ว", 409);
  }
  return relatedBooks[0];
}

function reopenConflictingCreation(catalog: Catalog, item: ReviewItem, updateReviewQueue: UpdateReviewQueue) {
  const confidence = new Map(item.candidates.map((candidate) => [candidate.book_id, candidate.confidence]));
  const candidates = reviewPublicationBooks(catalog.books, item)
    .filter(({ volume }) => volume === item.extracted.volume)
    .map(({ book_id, edition }) => ({ book_id, edition, confidence: confidence.get(book_id) ?? 0 }));
  const extracted = { ...item.extracted };
  delete extracted.resolution;
  delete extracted.resolution_reference_book_id;
  return updateReviewQueue((current) => ({
    items: current.items.map((record) => record.review_id === item.review_id
      ? { ...record, extracted, candidates } : record),
  }));
}

export async function resolveReview(resolution: ReviewResolution) {
  const conflict = await withIngestWrite(async ({ readCatalog, readReviewQueue, writeCatalog, updateReviewQueue }) => {
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
      if (!updated) {
        // The approved creation never reached the catalog and a related edition now exists.
        // Clear the recorded choice so the reviewer can select the updated catalog entry.
        await reopenConflictingCreation(catalog, item, updateReviewQueue);
        return new ReviewResolutionError("มีเล่มฉบับนี้อยู่แล้ว กรุณาเลือกตรวจและรวม", 409);
      }
      if (!previous) {
        // Record the validated choice before writing the catalog so retries can only complete that choice.
        await updateReviewQueue((current) => ({
          items: current.items.map((record) => record.review_id === item.review_id
            ? { ...record, extracted: { ...record.extracted, resolution, resolution_reference_book_id: referenceBookId } }
            : record),
        }));
      }
      if (updated !== catalog) await writeCatalog(updated);
    }
    await updateReviewQueue((current) => ({
      items: current.items.map((record) => record.review_id === item.review_id
        ? { ...record, status: "resolved" } : record),
    }));
  });
  if (conflict) throw conflict;
}
