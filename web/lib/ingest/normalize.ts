import type { ExtractedItem, NormalizedItem } from "./contracts";

export function arabicDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

export function normalizeVolume(value: ExtractedItem["volume"]): number | null {
  if (value === null) return null;
  const text = arabicDigits(String(value)).trim().replace(/^(?:เล่ม\s*|vol\.?\s*|#\s*)/i, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const volume = Number(text);
  return Number.isFinite(volume) && volume >= 0 ? volume : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeItem(item: ExtractedItem, rawText: string): NormalizedItem {
  const precision = item.release_date_precision;
  const date = item.release_date;
  const monthOnly = date === null || /^\d{4}-(?:0[1-9]|1[0-2])$/.test(date) || validDate(date);
  // A month has no day in this contract. Preserve its precision and source text.
  const release = precision === "day" && date && validDate(date)
    ? { release_date: date, release_date_precision: "day" as const }
    : precision === "month" && monthOnly
      ? { release_date: null, release_date_precision: "month" as const }
      : { release_date: null, release_date_precision: "unknown" as const };
  const evidence = item.edition_evidence?.trim();
  const hasEvidence = item.edition !== null && evidence && rawText.normalize("NFC").includes(evidence.normalize("NFC"));
  return {
    ...item,
    title: item.title?.trim() || null,
    publisher: item.publisher?.trim() || null,
    volume: normalizeVolume(item.volume),
    edition: hasEvidence ? item.edition : null,
    edition_evidence: hasEvidence ? evidence : null,
    edition_confidence: hasEvidence ? item.edition_confidence : null,
    ...release,
  };
}
