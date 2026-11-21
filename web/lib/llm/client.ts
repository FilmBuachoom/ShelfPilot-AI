import "server-only";

import OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ResponseFormatJSONSchema } from "openai/resources/shared";

interface StructuredCall {
  model: string;
  schema: Omit<ResponseFormatJSONSchema["json_schema"], "strict">;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  timeoutMs?: number;
}

interface StructuredResult<T> {
  // On a tool call or refusal, the caller can handle the original assistant message.
  data: T | null;
  message: ChatCompletionMessage;
}

export class LlmUnavailableError extends Error {
  constructor(cause: unknown) {
    super("ขณะนี้ผู้ช่วย AI ไม่พร้อมใช้งาน", { cause });
    this.name = "LlmUnavailableError";
  }
}

let client: OpenAI | undefined;

export async function callStructured<T>({
  model,
  schema,
  messages,
  tools,
  timeoutMs = 15_000,
}: StructuredCall): Promise<StructuredResult<T>> {
  try {
    client ??= new OpenAI();
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        tools,
        response_format: {
          type: "json_schema",
          json_schema: { ...schema, strict: true },
        },
      },
      { timeout: timeoutMs, maxRetries: 1 },
    );

    const choice = response.choices[0];
    if (!choice || choice.finish_reason === "length" || choice.finish_reason === "content_filter") {
      throw new Error("OpenAI returned an incomplete response");
    }

    const { message } = choice;
    if (message.tool_calls?.length || message.refusal) {
      return { data: null, message };
    }
    if (!message.content) {
      throw new Error("OpenAI returned an empty response");
    }

    return { data: JSON.parse(message.content) as T, message };
  } catch (error) {
    throw new LlmUnavailableError(error);
  }
}
