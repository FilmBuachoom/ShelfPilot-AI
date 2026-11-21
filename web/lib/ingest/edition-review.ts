import { EDITION_CONFIDENCE_THRESHOLD } from "./constants";
import type { NormalizedItem } from "./contracts";
import { normalizeSourceText } from "./source-id";

type EditionSignals = Pick<NormalizedItem, "edition" | "edition_evidence" | "edition_confidence">;
type EditionReview = { status: "needs_review"; reason: string };

/** Check the edition evidence before delegating to the title and duplicate rules. */
export function getEditionReview(item: EditionSignals, rawText: string): EditionReview | null {
  const evidence = normalizeSourceText(item.edition_evidence ?? "");
  if (item.edition === null || !evidence || !normalizeSourceText(rawText).includes(evidence)) {
    return { status: "needs_review", reason: "ประกาศไม่ระบุฉบับ" };
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
