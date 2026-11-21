import type { Edition } from "@/types/generated";
import { EDITION_CONFIDENCE_THRESHOLD } from "./constants";
import type { NormalizedItem } from "./contracts";
import { arabicDigits } from "./normalize";
import { locateSourceQuote, normalizeSourceText } from "./source-id";

type EditionSignals = Pick<NormalizedItem, "edition" | "edition_evidence" | "edition_confidence">
  & Partial<Pick<NormalizedItem, "title">>;
export type EditionReview = { status: "needs_review"; reason: string };

// Only direct format labels qualify. Unrecognized or mixed labels need a human.
const editionLabels: Record<Edition, RegExp> = {
  manga: /^(?:มังงะ|manga|漫画)$/iu,
  light_novel: /^(?:นิยาย|ไล(?:ต์|ท์)\s*โนเวล|light[\s-]+novel|ライトノベル)$/iu,
  special_set: /^(?:ชุดพิเศษ|บ็อกซ์\s*เซ(?:็ต|ต)|box[\s-]*set|special[\s-]+set)(?:\s*\((?:มังงะ|นิยาย|ไล(?:ต์|ท์)\s*โนเวล|manga|light[\s-]+novel)\))?$/iu,
  big_book: /^(?:บิ๊กบุ๊ก|บิ๊กบุ๊ค|big[\s-]*book)$/iu,
};

// A quote such as "มังงะ" can be a substring of "ไม่ใช่มังงะ".
const precedingNegation = /(?:ไม่ใช่|ไม่มี|\b(?:not|no)(?:\s+(?:a|an|the))?|\bnon[-‑])\s*(?:(?:ฉบับ(?:พิมพ์)?|ประเภท)\s*[:：]?\s*)?$/iu;
const attachedWordStart = /^[\p{L}\p{M}\p{N}]/u;
const attachedWordEnd = /[\p{L}\p{M}\p{N}]$/u;
const editionPrefix = /(?:^|[^\p{L}\p{M}\p{N}])(?:ฉบับ(?:พิมพ์)?|ประเภท)$/u;
const volumeMarker = /(?:เล่ม(?:ที่)?\s*|\bvol(?:ume)?\.?\s*|#\s*)(\d+(?:\.\d+)?)(?![\d.])/giu;

function hasAffirmativeOccurrence(text: string, quote: string, firstOffset: number, title?: string | null): boolean {
  const titleText = title ? normalizeSourceText(title) : "";
  const lowerText = text.toLowerCase();
  const lowerTitle = titleText.toLowerCase();
  for (let offset = firstOffset; offset >= 0; offset = text.indexOf(quote, offset + quote.length)) {
    const end = offset + quote.length;
    const titleOffset = lowerTitle ? lowerText.lastIndexOf(lowerTitle, offset) : -1;
    if (titleOffset >= 0 && titleOffset + lowerTitle.length >= end) continue;

    const precedingText = text.slice(Math.max(0, offset - 40), offset);
    if (precedingNegation.test(precedingText)) continue;
    if (attachedWordEnd.test(precedingText) && !editionPrefix.test(precedingText)) continue;
    const followingText = text.slice(end);
    if (attachedWordStart.test(followingText) && !/^(?:เล่ม|巻)/u.test(followingText)) continue;
    return true;
  }
  return false;
}

/** Check the edition evidence before delegating to the title and duplicate rules. */
export function getEditionReview(item: EditionSignals, rawText: string): EditionReview | null {
  const evidence = locateSourceQuote(rawText, item.edition_evidence ?? "");
  if (item.edition === null || evidence === null) {
    return { status: "needs_review", reason: "ประกาศไม่ระบุฉบับ" };
  }

  const label = evidence.quote
    .replace(/^(?:ฉบับ(?:พิมพ์)?|ประเภท)\s*[:：]?\s*/u, "")
    .replace(/\s+edition$/iu, "");
  if (!editionLabels[item.edition].test(label)
    || !hasAffirmativeOccurrence(evidence.text, evidence.quote, evidence.offset, item.title)) {
    return { status: "needs_review", reason: "หลักฐานไม่ยืนยันฉบับที่ระบุ" };
  }

  const confidence = item.edition_confidence;
  if (confidence === null || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { status: "needs_review", reason: "ค่าความมั่นใจของฉบับไม่ถูกต้องหรือไม่ระบุ" };
  }
  if (confidence < EDITION_CONFIDENCE_THRESHOLD) {
    return { status: "needs_review", reason: `ความมั่นใจ ${confidence} < ${EDITION_CONFIDENCE_THRESHOLD}` };
  }

  return null;
}

/** Scope quoted evidence to one title and volume in a multi-book announcement. */
export function getItemEditionReview(item: NormalizedItem, items: readonly NormalizedItem[], rawText: string, matchConfidence?: number): EditionReview | null {
  let evidenceText = rawText;
  if (items.length > 1) {
    const title = normalizeSourceText(item.title ?? "").toLowerCase();
    const others = items.filter((other) => other !== item).map((other) => ({
      title: normalizeSourceText(other.title ?? "").toLowerCase(), volume: other.volume,
    }));
    const lines = title && rawText.split(/\r?\n/).filter((line) => {
      const lower = normalizeSourceText(line).toLowerCase();
      if (!lower.includes(title)) return false;
      const volumes = new Set(Array.from(arabicDigits(line).matchAll(volumeMarker), ([, number]) => Number(number)));
      const [volume] = volumes;
      if (volumes.size > 1 || (volume !== undefined && item.volume !== null && volume !== item.volume)) {
        return false;
      }
      return !others.some((other) => other.title && lower.includes(other.title)
        && (volume === undefined || other.volume === null || other.volume === volume));
    });
    if (!lines || lines.length !== 1) {
      return { status: "needs_review", reason: "ต้องยืนยันว่าหลักฐานฉบับเป็นของรายการนี้" };
    }
    evidenceText = lines[0];
  }
  return getEditionReview(item, evidenceText)
    ?? (matchConfidence === undefined ? null : getEditionReview({ ...item, edition_confidence: matchConfidence }, evidenceText));
}
