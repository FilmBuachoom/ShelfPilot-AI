import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import common from "../../../schemas/common.schema.json";

export function withEditionSchema(contract: Record<string, unknown>) {
  // Structured Outputs resolves local references only.
  const schema = Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "$schema" && key !== "$id"));
  return {
    ...JSON.parse(JSON.stringify(schema).replaceAll("common.schema.json#/$defs/edition", "#/$defs/edition")),
    $defs: { edition: common.$defs.edition },
  };
}

export function loadIngestPrompt(filename: string) {
  let prompt: Promise<string> | undefined;
  return () => {
    const cwd = process.cwd();
    const webRoot = path.basename(cwd) === "web" ? cwd : path.join(cwd, "web");
    prompt ??= readFile(path.join(webRoot, "prompts", filename), "utf8").catch((error) => {
      prompt = undefined;
      throw error;
    });
    return prompt;
  };
}
