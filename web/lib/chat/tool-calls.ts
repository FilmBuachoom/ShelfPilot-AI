import "server-only";

import Ajv from "ajv";
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import common from "../../../schemas/common.schema.json";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import { editionLabels, type createEditionClarifier } from "./edition-clarification";
import type { createChatToolRegistry } from "./tools/registry";

type Registry = ReturnType<typeof createChatToolRegistry>["tools"];
const ajv = new Ajv();
const datePattern = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";

function defineTool<Name extends keyof Registry>(
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

const proposal = defineTool(
  "propose_shelf_update",
  "Preview all requested shelf changes in one call. Copy the volume expressions. Include edition only when specified by the reader.",
  {
    items: {
      type: "array", minItems: 1, maxItems: 20,
      items: {
        type: "object", additionalProperties: false, required: ["title_query", "action", "volumes"],
        properties: {
          title_query: { type: "string", minLength: 1, maxLength: 200 }, edition,
          action: { type: "string", enum: ["add", "remove"] },
          volumes: { type: "string", minLength: 1, maxLength: 1024 },
        },
      },
    },
  },
  ["items"],
);

export const chatToolDefinitions = [search.definition, status.definition, releases.definition, proposal.definition];

type ToolDispatch = { result: unknown; answer?: never } | { answer: ChatAnswer; result?: never };

export function dispatchChatTool(
  tools: Registry,
  editions: ReturnType<typeof createEditionClarifier>,
  name: string,
  encodedArgs: string,
  userText: string,
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
        return clarification ? { answer: clarification } : { result: tools.search_catalog(args) };
      }
      break;
    case "get_series_status":
      if (status.isValid(args)) {
        const clarification = editions.forSeries(args.series_id, args.edition);
        return clarification ? { answer: clarification } : { result: tools.get_series_status(args) };
      }
      break;
    case "list_releases":
      if (releases.isValid(args)) return { result: tools.list_releases(args) };
      break;
    case "propose_shelf_update": {
      if (!proposal.isValid(args)) break;
      const preview = tools.propose_shelf_update({ items: args.items, user_text: userText });
      const base = { book_ids: [], source_ids: [], not_found: false, needs_clarification: false };
      if (preview.status === "needs_clarification") {
        const options = preview.options?.map((opt) => opt.title + " (" + editionLabels[opt.edition] + ")").join(", ");
        const questions = {
          empty_request: "ต้องการเพิ่มหรือนำเล่มไหนออกจากคลัง?",
          invalid_volumes: "ช่วยระบุเลขเล่มอีกครั้ง เช่น 1, 3–5",
          title_not_found: "ยังไม่พบชื่อนี้ในแค็ตตาล็อก ลองระบุชื่อเต็มได้ไหม?",
          ambiguous_title: "หมายถึงเรื่องหรือฉบับไหน?",
          ambiguous_volume: "พบหลายรายการสำหรับเลขเล่มนี้ ช่วยระบุฉบับอีกครั้งได้ไหม?",
          conflicting_actions: "ต้องการเพิ่มหรือนำเล่มนี้ออกจากคลัง?",
        };
        const text = [preview.title_query, questions[preview.reason], options].filter(Boolean).join(" ");
        return { answer: { ...base, text, needs_clarification: true } };
      }
      for (const item of preview.items) {
        const clarification = editions.forSeries(item.series_id, item.edition);
        if (clarification) return { answer: clarification };
      }
      const { items, user_text, total } = preview;
      const text = total ? "ตรวจสอบรายการก่อนยืนยันการปรับคลัง" : "ไม่มีเล่มที่ต้องเปลี่ยนในคลัง";
      return { answer: { ...base, text, proposal: { items, user_text, total } } };
    }
    default:
      return { result: { error: "unknown_tool" } };
  }
  return { result: { error: "invalid_tool_arguments" } };
}
