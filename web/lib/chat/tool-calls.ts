import "server-only";

import Ajv from "ajv";
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import common from "../../../schemas/common.schema.json";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import type { createEditionClarifier } from "./edition-clarification";
import type { createChatToolRegistry } from "./tools/registry";

type Registry = ReturnType<typeof createChatToolRegistry>["tools"];
type ReadTool = "search_catalog" | "get_series_status" | "list_releases";
const ajv = new Ajv();
const datePattern = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";

function defineTool<Name extends ReadTool>(
  name: Name,
  description: string,
  properties: Record<string, object>,
  required: readonly string[],
) {
  const parameters = { type: "object", properties, required, additionalProperties: false };
  const definition: ChatCompletionFunctionTool = { type: "function", function: { name, description, parameters } };
  return { definition, isValid: ajv.compile<Parameters<Registry[Name]>[0]>(parameters) };
}

const edition = { type: "string", enum: common.$defs.edition.enum };

const search = defineTool(
  "search_catalog",
  "Find books by title or alias. Use this to discover series IDs and editions.",
  { query: { type: "string", minLength: 1, maxLength: 200 }, edition },
  ["query"],
);
const status = defineTool(
  "get_series_status",
  "Find the latest listed volume and the reader's owned, missing, and upcoming volumes for one series and edition.",
  { series_id: { type: "string", minLength: 1, maxLength: 200 }, edition },
  ["series_id", "edition"],
);
const releases = defineTool(
  "list_releases",
  "Find volumes with release dates in the inclusive window. Use dates in YYYY-MM-DD format.",
  { from: { type: "string", pattern: datePattern }, to: { type: "string", pattern: datePattern } },
  ["from", "to"],
);

export const readToolDefinitions = [search.definition, status.definition, releases.definition];

type ToolDispatch = { result: unknown; clarification?: never } | { clarification: ChatAnswer; result?: never };

export function dispatchReadTool(
  tools: Registry,
  editions: ReturnType<typeof createEditionClarifier>,
  name: string,
  encodedArgs: string,
): ToolDispatch {
  if (encodedArgs.length > 4096) return { result: { error: "invalid_tool_arguments" } };

  let args: unknown;
  try {
    args = JSON.parse(encodedArgs);
  } catch {
    return { result: { error: "invalid_tool_arguments" } };
  }

  switch (name) {
    case "search_catalog":
      if (search.isValid(args)) {
        const clarification = editions.forSearch(args.query);
        return clarification ? { clarification } : { result: tools.search_catalog(args) };
      }
      break;
    case "get_series_status":
      if (status.isValid(args)) {
        const clarification = editions.forSeries(args.series_id, args.edition);
        return clarification ? { clarification } : { result: tools.get_series_status(args) };
      }
      break;
    case "list_releases":
      if (releases.isValid(args)) return { result: tools.list_releases(args) };
      break;
    default:
      return { result: { error: "unknown_tool" } };
  }
  return { result: { error: "invalid_tool_arguments" } };
}
