import "server-only";

import { readCatalog, updateJsonAtomic } from "@/lib/data/store";
import type { Source } from "@/types/generated";
import { applyMatches } from "./apply";
import { extractAnnouncement } from "./extract";
import { matchAnnouncement } from "./match";
import { createSourceId } from "./source-id";
import type { IngestContext, IngestInput, PipelineResult } from "./contracts";

function alreadyImported(source: Source): PipelineResult {
  return { status: "already_imported", message: "นำเข้าแล้ว", source, extraction: { items: [] }, decisions: [] };
}

export async function runPipeline(input: IngestInput): Promise<PipelineResult> {
  const sourceId = createSourceId(input.raw_text, input.source_url);
  const snapshot = await readCatalog();
  const existing = snapshot.sources.find((source) => source.source_id === sourceId);
  if (existing) return alreadyImported(existing);

  const extraction = await extractAnnouncement(input);
  const context: IngestContext = {
    source: {
      source_id: sourceId,
      source_url: input.source_url.trim(),
      raw_text: input.raw_text,
      publisher: input.publisher_hint?.trim() || extraction.items.find((item) => item.publisher)?.publisher || "",
      imported_at: new Date().toISOString(),
    },
    extraction,
  };
  const matches = await Promise.all(extraction.items.map((item) => matchAnnouncement(item, snapshot.books)));
  let result = alreadyImported(context.source);
  await updateJsonAtomic("catalog.json", (current) => {
    const existing = current.sources.find((source) => source.source_id === sourceId);
    if (existing) {
      result = alreadyImported(existing);
      return current;
    }

    const applied = applyMatches(current, context, matches);
    const imported = applied.catalog !== current;
    result = {
      ...context,
      decisions: applied.decisions,
      status: imported ? "imported" : "not_imported",
      message: imported ? "บันทึกรายการที่จับคู่ได้แล้ว" : "ไม่มีรายการที่บันทึกในแค็ตตาล็อก",
    };
    return applied.catalog;
  });
  return result;
}
