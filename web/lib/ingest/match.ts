import "server-only";

import contract from "../../../schemas/match_result.schema.json";
import { callStructured, LlmUnavailableError } from "@/lib/llm/client";
import { extractModel } from "@/lib/llm/models";
import { pruneBook } from "@/lib/llm/prune";
import { searchCatalog } from "@/lib/search/fuse";
import type { Book } from "@/types/generated";
import type { MatchResult } from "@/types/generated/match_result";
import type { NormalizedItem } from "./contracts";
import { loadIngestPrompt, withEditionSchema } from "./structured";

export type CatalogMatch = MatchResult & { rejectedCandidate?: true };

const loadPrompt = loadIngestPrompt("match-system.md");
export const matchResultSchema = withEditionSchema(contract);

async function match(
  title: string,
  details?: { item: NormalizedItem; books: readonly Book[] },
): Promise<CatalogMatch | null> {
  const item = details?.item;
  const candidates = await searchCatalog(title, { limit: 5, volume: item?.volume, books: details?.books });
  if (!candidates.length) return null;

  const { data } = await callStructured<MatchResult>({
    model: extractModel,
    schema: { name: "match_result", schema: matchResultSchema },
    messages: [
      { role: "system", content: await loadPrompt() },
      { role: "user", content: JSON.stringify({
        title,
        publisher: item?.publisher ?? null,
        volume: item?.volume ?? null,
        edition: item?.edition ?? null,
        edition_evidence: item?.edition_evidence ?? null,
        candidates: candidates.map((book) => {
          const { book_id, title, aliases, volume, edition, publisher } = pruneBook(book);
          return { book_id, title, aliases, volume, edition, publisher };
        }),
      }) },
    ],
  });

  if (!data) throw new LlmUnavailableError(new Error("Matcher refused or returned no result"));
  if (data.candidate_book_id === null) return { ...data, matched_alias: null };

  const candidate = candidates.find(({ book_id }) => book_id === data.candidate_book_id);
  if (!candidate) {
    return {
      ...data,
      candidate_book_id: null,
      matched_alias: null,
      rejectedCandidate: true,
      reason: "ผลจับคู่อ้างถึงหนังสือนอกชุดตัวเลือก",
    };
  }
  return {
    ...data,
    matched_alias: candidate.aliases.find((alias) => alias === data.matched_alias) ?? null,
  };
}

export function matchAnnouncement(item: NormalizedItem, books: readonly Book[]) {
  return match(item.title ?? "", { item, books });
}

export function matchTitle(query: string) {
  return match(query);
}
