import { checkChatRateLimit } from "@/lib/chat/rate-limit";
import { runChat } from "@/lib/chat/run";
import {
  CHAT_RATE_LIMITED, CHAT_UNAVAILABLE, MAX_CHAT_MESSAGES, MAX_MESSAGE_LENGTH, type ChatMessageInput,
} from "@/lib/chat/shared";
import { readCatalog, readShelf } from "@/lib/data/store";
import { AI_ENABLED } from "@/lib/feature-flags";

export const maxDuration = 60;

function parseMessages(body: unknown): ChatMessageInput[] | null {
  if (!body || typeof body !== "object" || !("messages" in body) || !Array.isArray(body.messages)) return null;

  const history: unknown[] = body.messages;
  if (history.length === 0 || history.length > MAX_CHAT_MESSAGES) return null;

  const messages: ChatMessageInput[] = [];
  for (const entry of history) {
    if (!entry || typeof entry !== "object" || !("role" in entry) || !("content" in entry)) return null;
    const { role, content } = entry;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length > MAX_MESSAGE_LENGTH || !content.trim()) return null;
    messages.push({ role, content: content.trim() });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
}

export async function POST(request: Request) {
  if (!AI_ENABLED) return Response.json({ error: "Chat is disabled" }, { status: 404 });

  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) return Response.json({ error: "Invalid chat messages" }, { status: 400 });

  try {
    const limit = await checkChatRateLimit(request);
    if (!limit.allowed) {
      return Response.json(CHAT_RATE_LIMITED, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" },
      });
    }
  } catch {
    return Response.json(CHAT_UNAVAILABLE, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [catalog, shelf] = await Promise.all([readCatalog(), readShelf()]);
    return Response.json(await runChat(messages, { catalog, shelf }));
  } catch {
    return Response.json(CHAT_UNAVAILABLE);
  }
}
