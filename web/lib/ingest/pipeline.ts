import "server-only";

import { readCatalog, readReviewQueue, updateJsonAtomic } from "@/lib/data/store";
import type { Source } from "@/types/generated";
import { applyMatches } from "./apply";
import { extractAnnouncement } from "./extract";
import { matchAnnouncement } from "./match";
import { findCompletedReviewSource, queueReviews, withReviewWrite } from "./review-queue";
import { createSourceId } from "./source-id";
import type { IngestContext, IngestInput, MatchDecision, PipelineResult } from "./contracts";

function alreadyImported(source: Source): PipelineResult {
  return { status: "already_imported", message: "นำเข้าแล้ว", source, extraction: { items: [] }, decisions: [] };
}

function findImportedSource(sources: readonly Source[], sourceUrl: string, sourceId: string) {
  return sources.find((source) => source.source_id === sourceId)
    ?? sources.find((source) => source.source_url.trim() === sourceUrl
      && createSourceId(source.raw_text, source.source_url) === sourceId);
}

export async function runPipeline(input: IngestInput): Promise<PipelineResult> {
  const sourceUrl = input.source_url.trim();
  const sourceId = createSourceId(input.raw_text, sourceUrl);
  const snapshot = await readCatalog();
  const existing = findImportedSource(snapshot.sources, sourceUrl, sourceId);
  if (existing) return alreadyImported(existing);
  const reviewed = findCompletedReviewSource((await readReviewQueue()).items.filter(({ source_id }) => source_id === sourceId));
  if (reviewed) return { ...alreadyImported(reviewed), message: "ประกาศนี้เคยส่งเข้าคิวตรวจสอบแล้ว" };

  const extraction = await extractAnnouncement(input);
  const context: IngestContext = {
    source: {
      source_id: sourceId,
      source_url: sourceUrl,
      raw_text: input.raw_text,
      publisher: extraction.items.find((item) => item.publisher)?.publisher || input.publisher_hint?.trim() || "",
      imported_at: new Date().toISOString(),
    },
    extraction,
  };
  const matches = await Promise.all(extraction.items.map((item) => matchAnnouncement(item, snapshot.books)));
  return withReviewWrite(async () => {
    const current = await readCatalog();
    const existing = findImportedSource(current.sources, sourceUrl, sourceId);
    if (existing) return alreadyImported(existing);
    const savedReviews = (await readReviewQueue()).items.filter(({ source_id }) => source_id === sourceId);
    const reviewed = findCompletedReviewSource(savedReviews);
    if (reviewed) return { ...alreadyImported(reviewed), message: "ประกาศนี้เคยส่งเข้าคิวตรวจสอบแล้ว" };

    const previouslyQueued = new Map<number, MatchDecision>();
    for (const record of savedReviews) {
      const { item_index, item_count, title, volume } = record.extracted;
      if (typeof item_index !== "number") continue;
      const retry = extraction.items[item_index];
      if (extraction.items.length !== item_count || !retry || retry.title !== title || retry.volume !== volume) {
        throw new Error("The extraction changed while recovering a partially imported announcement.");
      }
      previouslyQueued.set(item_index, { match_status: "needs_review", candidate_book_id: null, matched_alias: null, reason: record.reason });
    }
    const applied = applyMatches(current, context, matches, previouslyQueued);
    // Persist review rows first so a successful catalog write cannot hide an incomplete queue on retry.
    await queueReviews(current, context, matches, applied.decisions);
    const imported = applied.catalog !== current;
    if (imported) await updateJsonAtomic("catalog.json", () => applied.catalog);
    const hasReview = applied.decisions.some(({ match_status }) => match_status === "needs_review");
    return {
      ...context,
      decisions: applied.decisions,
      status: imported ? "imported" : "not_imported",
      message: hasReview
        ? imported ? "บันทึกรายการที่จับคู่ได้และส่งรายการที่เหลือเข้าคิวตรวจสอบ" : "ส่งรายการเข้าคิวตรวจสอบแล้ว"
        : imported ? "บันทึกรายการที่จับคู่ได้แล้ว" : "ไม่มีรายการที่บันทึกในแค็ตตาล็อก",
    };
  });
}
