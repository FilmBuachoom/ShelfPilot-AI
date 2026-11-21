import "server-only";

import contract from "../../../schemas/extraction.schema.json";
import { callStructured, LlmUnavailableError } from "@/lib/llm/client";
import { extractModel } from "@/lib/llm/models";
import type { Extraction } from "@/types/generated/extraction";
import { normalizeItem } from "./normalize";
import { loadIngestPrompt, withEditionSchema } from "./structured";
import type { IngestInput, NormalizedExtraction } from "./contracts";

export const extractionSchema = withEditionSchema(contract);
const loadPrompt = loadIngestPrompt("extract-system.md");

export async function extractAnnouncement(input: IngestInput): Promise<NormalizedExtraction> {
  const result = await callStructured<Extraction>({
    model: extractModel,
    schema: { name: "extraction", schema: extractionSchema },
    messages: [
      { role: "system", content: await loadPrompt() },
      { role: "user", content: JSON.stringify({ raw_text: input.raw_text, publisher_hint: input.publisher_hint ?? null }) },
    ],
  });
  if (!result.data || !Array.isArray(result.data.items)) {
    throw new LlmUnavailableError(new Error("Extractor refused or returned no items"));
  }
  return { items: result.data.items.map((item) => normalizeItem(item, input.raw_text)) };
}
