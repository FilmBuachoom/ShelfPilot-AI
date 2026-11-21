import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { callStructured } from "@/lib/llm/client";
import { chatModel } from "@/lib/llm/models";
import { todayInBangkok } from "@/lib/shelf/releases";
import type { Catalog, UserShelf } from "@/types/generated";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import { createEditionClarifier } from "./edition-clarification";
import chatAnswerSchema from "../../../schemas/chat_answer.schema.json";
import { CHAT_NOT_FOUND, CHAT_UNAVAILABLE, MAX_CHAT_MESSAGES, type ChatMessageInput } from "./shared";
import { dispatchChatTool, chatToolDefinitions } from "./tool-calls";
import { createChatToolRegistry } from "./tools/registry";

const { type, properties, required, additionalProperties } = chatAnswerSchema;
// Only deterministic tool results may attach a shelf proposal to the API response.
const modelProperties = Object.fromEntries(required.map((key) => [key, properties[key as keyof typeof properties]]));
const schema = { name: "chat_answer", schema: { type, properties: modelProperties, required, additionalProperties } };
const isChatAnswer = new Ajv().compile<Omit<ChatAnswer, "proposal">>(schema.schema);
const maxToolRounds = 3;
const maxCallsPerRound = 4;
const turnTimeout = 15_000;

async function loadPrompt() {
  const cwd = process.cwd();
  const relative = path.join("prompts", "chat-system.md");
  try {
    return await readFile(path.join(cwd, relative), "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    return readFile(path.join(cwd, "web", relative), "utf8");
  }
}

export async function runChat(
  history: readonly ChatMessageInput[],
  context: { catalog: Catalog; shelf: UserShelf },
): Promise<ChatAnswer> {
  if (context.catalog.books.length === 0) return CHAT_NOT_FOUND;

  try {
    const systemPrompt = await loadPrompt();
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt + "\nวันที่ในประเทศไทย: " + todayInBangkok() },
      ...history.slice(-MAX_CHAT_MESSAGES).map(({ role, content }) => ({ role, content })),
    ];
    const registry = createChatToolRegistry(context);
    const userText = history.at(-1)?.content ?? "";
    const editionClarifier = createEditionClarifier(context.catalog, userText);
    const deadline = Date.now() + turnTimeout;

    for (let round = 0; round <= maxToolRounds; round++) {
      const timeoutMs = deadline - Date.now();
      if (timeoutMs <= 0) break;

      const { data, message } = await callStructured<unknown>({
        model: chatModel,
        messages,
        schema,
        tools: round < maxToolRounds ? chatToolDefinitions : undefined,
        timeoutMs,
        maxRetries: 0,
        maxCompletionTokens: 700,
        reasoningEffort: /^gpt-6-luna(?:-|$)/.test(chatModel) ? "none" : undefined,
      });
      if (isChatAnswer(data)) {
        if (data.not_found) return CHAT_NOT_FOUND;
        const answer = data.text.trim();
        if (!answer || /(?:[a-z][a-z0-9+.-]*:\/\/|www\.|\]\(|mailto:|\b[a-z0-9-]+\.(?:com|org|net|co\.th|io|app)\b)/i.test(answer)) {
          return CHAT_UNAVAILABLE;
        }
        const ids = registry.guardCitations(data);
        if (!data.needs_clarification && ids.book_ids.length + ids.source_ids.length === 0) {
          return CHAT_NOT_FOUND;
        }
        return { ...data, ...ids, text: answer };
      }

      const calls = message.tool_calls;
      if (!calls?.length || calls.length > maxCallsPerRound || round === maxToolRounds) break;
      messages.push({
        role: "assistant",
        content: message.content,
        tool_calls: calls,
      });
      const splitProposal = calls.filter((c) => c.type === "function" && c.function.name === "propose_shelf_update").length > 1;
      for (const call of calls) {
        if (splitProposal) {
          messages.push({ role: "tool", tool_call_id: call.id, content: "Retry all changes together in one propose_shelf_update call." });
          continue;
        }
        const dispatched = call.type === "function"
          ? dispatchChatTool(registry.tools, editionClarifier, call.function.name, call.function.arguments, userText)
          : { result: { error: "unknown_tool" } };
        if (dispatched.answer) return dispatched.answer;
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(dispatched.result) });
      }
    }
  } catch {
    return CHAT_UNAVAILABLE;
  }

  return CHAT_UNAVAILABLE;
}
