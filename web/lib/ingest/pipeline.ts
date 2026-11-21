import "server-only";

import { readCatalog } from "@/lib/data/store";
import { extractAnnouncement } from "./extract";
import { createSourceId } from "./source-id";
import type { Catalog } from "@/types/generated";
import type { IngestContext, IngestInput, NormalizedExtraction, PipelineResult } from "./contracts";

export interface PipelineStages<Matched, Decided> {
  match: (context: IngestContext) => Promise<Matched>;
  disambiguate: (context: IngestContext, matches: Matched) => Promise<Decided>;
  // #11/#12 own catalog and review-queue persistence and their atomic writes.
  write: (context: IngestContext, decisions: Decided) => Promise<void>;
}
interface PipelineDependencies<Matched, Decided> {
  readCatalog?: () => Promise<Catalog>;
  extract?: (input: IngestInput) => Promise<NormalizedExtraction>;
  now?: () => Date;
  stages?: Partial<PipelineStages<Matched, Decided>>;
}

export async function runPipeline<Matched = unknown, Decided = unknown>(
  input: IngestInput,
  dependencies: PipelineDependencies<Matched, Decided> = {},
): Promise<PipelineResult> {
  const sourceId = createSourceId(input.raw_text, input.source_url);
  const catalog = await (dependencies.readCatalog ?? readCatalog)();
  const existing = catalog.sources.find((source) => source.source_id === sourceId);
  if (existing) {
    return { status: "already_imported", message: "นำเข้าแล้ว", source: existing, extraction: { items: [] } };
  }
  const extraction = await (dependencies.extract ?? extractAnnouncement)(input);
  const context: IngestContext = {
    source: {
      source_id: sourceId,
      source_url: input.source_url.trim(),
      raw_text: input.raw_text,
      publisher: input.publisher_hint?.trim() || extraction.items.find((item) => item.publisher)?.publisher || "",
      imported_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    },
    extraction,
  };
  const stages = dependencies.stages;
  if (!stages?.match || !stages.disambiguate || !stages.write) {
    return { ...context, status: "dry_run", message: "สกัดข้อมูลแล้ว ยังไม่ได้บันทึกในแค็ตตาล็อก" };
  }
  const matched = await stages.match(context);
  const decided = await stages.disambiguate(context, matched);
  await stages.write(context, decided);
  return { ...context, status: "imported", message: "นำเข้าแล้ว" };
}
