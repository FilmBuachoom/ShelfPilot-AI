import "server-only";

import { readReviewQueue, updateJsonAtomic } from "@/lib/data/store";
import { normalizeTitle } from "@/lib/search/normalize";
import type { Catalog } from "@/types/generated";
import { createReviewedBook, mergeReviewedBook } from "./apply";
import type { ReviewResolution } from "./contracts";
import { findCompletedReviewSource, withReviewWrite } from "./review-queue";
import { canCreateFromReview, reviewDraft, type ReviewItem } from "./review-record";

export class ReviewResolutionError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
  }
}

function applyApproval(catalog: Catalog, record: ReviewItem, resolution: Exclude<ReviewResolution, { action: "skip" }>) {
  const draft = reviewDraft(record);
  if (!draft) throw new ReviewResolutionError("รายการนี้ไม่มีข้อมูลประกาศสำหรับอนุมัติ", 409);
  const { extracted, source } = draft;

  if (resolution.action === "merge") {
    const option = record.candidates.find(({ book_id }) => book_id === resolution.book_id);
    const target = catalog.books.find(({ book_id }) => book_id === option?.book_id);
    if (!target || target.edition !== option?.edition || (extracted.volume !== null && target.volume !== extracted.volume)) {
      throw new ReviewResolutionError("ตัวเลือกนี้ไม่ตรงกับรายการในคิวแล้ว", 409);
    }
    return mergeReviewedBook(catalog, source, extracted, target);
  }

  const { title, volume } = extracted;
  if (!canCreateFromReview(record) || !title || volume === null) {
    throw new ReviewResolutionError("ต้องมีชื่อเรื่อง เลขเล่ม และสำนักพิมพ์ก่อนสร้างรายการใหม่", 409);
  }
  const candidateIds = new Set(record.candidates.map(({ book_id }) => book_id));
  const candidates = catalog.books.filter(({ book_id }) => candidateIds.has(book_id));
  const normalizedTitle = normalizeTitle(title);
  const books = candidates.length ? candidates : catalog.books.filter((book) =>
    [book.title, ...book.aliases].some((name) => normalizeTitle(name) === normalizedTitle));
  if (!books.length && candidateIds.size) {
    throw new ReviewResolutionError("ตัวเลือกในคิวไม่มีอยู่ในแค็ตตาล็อกแล้ว", 409);
  }
  if (new Set(books.map(({ series_id }) => series_id)).size > 1) {
    throw new ReviewResolutionError("พบหลายชุดหนังสือ กรุณาเลือกเล่มที่ตรงกันก่อน", 409);
  }
  const updated = createReviewedBook(
    catalog, source, { ...extracted, title, volume, edition: resolution.edition },
    extracted.publisher || source.publisher, books[0],
  );
  if (!updated) throw new ReviewResolutionError("มีเล่มฉบับนี้อยู่แล้ว กรุณาเลือกตรวจและรวม", 409);
  return updated;
}

export function resolveReview(resolution: ReviewResolution) {
  return withReviewWrite(async () => {
    const queue = await readReviewQueue();
    const item = queue.items.find(({ review_id }) => review_id === resolution.review_id);
    if (!item) throw new ReviewResolutionError("ไม่พบรายการตรวจสอบ", 404);
    if (item.status === "resolved") return;

    if (resolution.action !== "skip") {
      // The catalog write is idempotent if marking the queue resolved has to be retried.
      await updateJsonAtomic("catalog.json", (catalog) => {
        const records = queue.items.filter(({ source_id }) => source_id === item.source_id);
        if (typeof item.extracted.item_count === "number" && !findCompletedReviewSource(records)
          && !catalog.sources.some(({ source_id }) => source_id === item.source_id)) {
          throw new ReviewResolutionError("การนำเข้าประกาศยังไม่เสร็จ กรุณาส่งประกาศเดิมอีกครั้ง", 409);
        }
        return applyApproval(catalog, item, resolution);
      });
    }
    await updateJsonAtomic("review_queue.json", (current) => ({
      items: current.items.map((record) => record.review_id === item.review_id
        ? { ...record, status: "resolved" } : record),
    }));
  });
}
