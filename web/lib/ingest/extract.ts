import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import contract from "../../../schemas/extraction.schema.json";
import common from "../../../schemas/common.schema.json";
import { callStructured, LlmUnavailableError } from "@/lib/llm/client";
import { extractModel } from "@/lib/llm/models";
import type { Extraction } from "@/types/generated/extraction";
import { normalizeItem } from "./normalize";
import type { IngestInput, NormalizedExtraction } from "./contracts";

// OpenAI resolves local references only; retain the canonical shared enum.
const schema = Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "$schema" && key !== "$id"));
export const extractionSchema = {
  ...JSON.parse(JSON.stringify(schema).replaceAll("common.schema.json#/$defs/edition", "#/$defs/edition")),
  $defs: { edition: common.$defs.edition },
};

let prompt: Promise<string> | undefined;

export async function extractAnnouncement(input: IngestInput): Promise<NormalizedExtraction> {
  const cwd = process.cwd();
  const webRoot = path.basename(cwd) === "web" ? cwd : path.join(cwd, "web");
  prompt ??= readFile(path.join(webRoot, "prompts/extract-system.md"), "utf8")
    .catch((error) => { prompt = undefined; throw error; });
  const result = await callStructured<Extraction>({
    model: extractModel,
    schema: { name: "extraction", schema: extractionSchema },
    messages: [
      { role: "system", content: await prompt },
      { role: "user", content: JSON.stringify({ raw_text: input.raw_text, publisher_hint: input.publisher_hint ?? null }) },
    ],
  });
  if (!result.data || !Array.isArray(result.data.items)) {
    throw new LlmUnavailableError(new Error("Extractor refused or returned no items"));
  }
  return { items: result.data.items.map((item) => normalizeItem(item, input.raw_text)) };
}
