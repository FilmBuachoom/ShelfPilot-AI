import "server-only";

export const chatModel = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4.1-mini";
export const extractModel = process.env.OPENAI_EXTRACT_MODEL?.trim() || "gpt-4.1";
