import type { ChatAnswer } from "@/types/generated/chat-answer";

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export const MAX_CHAT_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 1500;

export const CHAT_UNAVAILABLE: ChatAnswer = {
  text: "ผู้ช่วยยังตอบไม่ได้ตอนนี้ ใช้ปุ่ม ⚡ หรือคลังได้ตามปกติ",
  book_ids: [],
  source_ids: [],
  not_found: false,
  needs_clarification: false,
};

export const CHAT_NOT_FOUND: ChatAnswer = {
  text: "ยังไม่พบในแค็ตตาล็อก ลองค้นด้วยชื่อเรื่องหรือระบุฉบับพิมพ์เพิ่มเติม",
  book_ids: [],
  source_ids: [],
  not_found: true,
  needs_clarification: false,
};
