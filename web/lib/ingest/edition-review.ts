import type { Edition } from "@/types/generated";
import { EDITION_CONFIDENCE_THRESHOLD } from "./constants";
import type { NormalizedItem } from "./contracts";
import { locateSourceQuote } from "./source-id";

type EditionSignals = Pick<NormalizedItem, "edition" | "edition_evidence" | "edition_confidence">;
type EditionReview = { status: "needs_review"; reason: string };

// Only direct format labels qualify. Unrecognized or mixed labels need a human.
const editionLabels: Record<Edition, RegExp> = {
  manga: /^(?:มังงะ|manga|漫画)$/iu,
  light_novel: /^(?:นิยาย|ไล(?:ต์|ท์)\s*โนเวล|light[\s-]+novel|ライトノベル)$/iu,
  special_set: /^(?:ชุดพิเศษ|บ็อกซ์\s*เซ(?:็ต|ต)|box[\s-]*set|special[\s-]+set)(?:\s*\((?:มังงะ|นิยาย|ไล(?:ต์|ท์)\s*โนเวล|manga|light[\s-]+novel)\))?$/iu,
  big_book: /^(?:บิ๊กบุ๊ก|บิ๊กบุ๊ค|big[\s-]*book)$/iu,
};

// A quote such as "มังงะ" can be a substring of "ไม่ใช่มังงะ".
const precedingNegation = /(?:ไม่ใช่|ไม่มี|\b(?:not|no)(?:\s+(?:a|an|the))?)\s*(?:(?:ฉบับ(?:พิมพ์)?|ประเภท)\s*[:：]?\s*)?$/iu;

function hasAffirmativeOccurrence(text: string, quote: string, firstOffset: number): boolean {
  for (let offset = firstOffset; offset >= 0; offset = text.indexOf(quote, offset + quote.length)) {
    const precedingText = text.slice(Math.max(0, offset - 40), offset);
    if (!precedingNegation.test(precedingText)) return true;
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
    || !hasAffirmativeOccurrence(evidence.text, evidence.quote, evidence.offset)) {
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
