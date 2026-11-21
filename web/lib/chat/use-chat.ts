"use client";

import { useCallback, useRef, useState } from "react";
import { useCatalog } from "@/lib/data/catalog-provider";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import { answerQuick, type QuickAction } from "./quick";
import { CHAT_RATE_LIMITED, CHAT_UNAVAILABLE, MAX_CHAT_MESSAGES, MAX_MESSAGE_LENGTH, type ChatMessageInput } from "./shared";

type Message = {
  id: number;
  role: ChatMessageInput["role"];
  text: string;
  book_ids?: ChatAnswer["book_ids"];
  source_ids?: ChatAnswer["source_ids"];
};

export function useChat() {
  const { books, sources, collection } = useCatalog();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [revealId, setRevealId] = useState<number>();
  const onRevealComplete = useCallback((id: number) => {
    setRevealId((current) => current === id ? undefined : current);
  }, []);
  const inFlight = useRef(false);
  const nextId = useRef(0);

  function appendReply(answer: ChatAnswer, animate = false) {
    const id = ++nextId.current;
    const { text, book_ids, source_ids } = answer;
    setMessages((current) => [...current, {
      id,
      role: "assistant",
      text,
      book_ids: book_ids.filter((bookId) => books.has(bookId)),
      source_ids: source_ids.filter((sourceId) => sources.has(sourceId)),
    }]);
    if (animate && text !== CHAT_UNAVAILABLE.text) setRevealId(id);
  }

  async function onSend(text: string) {
    const content = text.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH || inFlight.current) return;

    inFlight.current = true;
    setPending(true);
    setRevealId(undefined);
    const id = ++nextId.current;
    setMessages((current) => [...current, { id, role: "user", text: content }]);
    const history: ChatMessageInput[] = messages.slice(1 - MAX_CHAT_MESSAGES).map(({ role, text }) => ({
      role,
      content: text.slice(0, MAX_MESSAGE_LENGTH),
    }));
    history.push({ role: "user", content });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: AbortSignal.timeout(18_000),
      });
      if (response.status === 429) {
        appendReply(CHAT_RATE_LIMITED);
        return;
      }
      if (!response.ok) throw new Error("Chat request failed");
      appendReply(await response.json() as ChatAnswer, true);
    } catch {
      appendReply(CHAT_UNAVAILABLE);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function onQuick(label: string, action?: QuickAction) {
    if (inFlight.current) return;
    if (!action) {
      void onSend(label);
      return;
    }

    setRevealId(undefined);
    const id = ++nextId.current;
    setMessages((current) => [...current, { id, role: "user", text: label }]);
    appendReply(answerQuick(action, books, collection.series));
  }

  return { messages, pending, revealId, onRevealComplete, onSend, onQuick };
}
