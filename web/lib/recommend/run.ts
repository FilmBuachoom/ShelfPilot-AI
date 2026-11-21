import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import common from "../../../schemas/common.schema.json";
import contract from "../../../schemas/recommendation.schema.json";
import { callStructured } from "@/lib/llm/client";
import { chatModel } from "@/lib/llm/models";
import { pruneBook } from "@/lib/llm/prune";
import type { Catalog, UserShelf } from "@/types/generated";
import type { Recommendation } from "@/types/generated/recommendation";
import { buildCandidates, type Candidate } from "./candidates";
import { catalogVersion, type RecommendationResponse } from "./contracts";
import { guardRecommendations } from "./guard";

const PROMPT_VERSION = 1;
const CACHE_LIMIT = 32;
const cache = new Map<string, Promise<RecommendationResponse>>();

// Structured Outputs resolves references within the supplied schema only.
const schema = {
  type: contract.type,
  additionalProperties: contract.additionalProperties,
  required: contract.required,
  properties: contract.properties,
  $defs: {
    book_id: common.$defs.book_id,
    source_id: common.$defs.source_id,
    item: {
      ...contract.$defs.item,
      properties: {
        ...contract.$defs.item.properties,
        book_id: { $ref: "#/$defs/book_id" },
        source_ids: { ...contract.$defs.item.properties.source_ids, items: { $ref: "#/$defs/source_id" } },
      },
    },
  },
};

function candidateIds({ book, source_ids }: Candidate) {
  return { book_id: book.book_id, source_ids };
}

function candidateInput({ book, source_ids }: Candidate) {
  return { ...pruneBook(book), source_ids };
}

async function generate(catalog: Catalog, shelf: UserShelf, version: string): Promise<RecommendationResponse> {
  const candidates = buildCandidates(catalog, shelf);
  if (!candidates.continue.length && !candidates.similar.length) {
    return { continue: [], similar: [], catalogVersion: version, fallback: false };
  }

  try {
    const prompt = await readFile(path.join(process.cwd(), "prompts/recommend-system.md"), "utf8");
    const { data } = await callStructured<Recommendation>({
      model: chatModel,
      schema: { name: "recommendation", schema },
      timeoutMs: 5_000,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            shelf: candidates.shelfSummary,
            continue: candidates.continue.map((candidate) => ({
              ...candidateInput(candidate), status: candidate.status,
            })),
            similar: candidates.similar.map(candidateInput),
          }),
        },
      ],
    });
    if (!data) throw new Error("Recommendation model returned no results");

    return {
      continue: guardRecommendations(data.continue, candidates.continue),
      similar: guardRecommendations(data.similar, candidates.similar),
      catalogVersion: version,
      fallback: false,
    };
  } catch {
    return {
      continue: candidates.continue.map(candidateIds),
      similar: candidates.similar.map(candidateIds),
      catalogVersion: version,
      fallback: true,
    };
  }
}

export function getRecommendations(catalog: Catalog, shelf: UserShelf, refresh = false) {
  const version = catalogVersion(catalog.updated_at, catalog.books.length);
  const ownedIds = shelf.owned.map(({ book_id }) => book_id).sort();
  const key = createHash("sha256").update(JSON.stringify([ownedIds, version, PROMPT_VERSION])).digest("hex");
  const cached = cache.get(key);
  if (cached && !refresh) return cached;
  if (cached) cache.delete(key);

  const result = generate(catalog, shelf, version).then((response) => {
    // Keep transient failures retryable without evicting newer results from a refresh.
    if (response.fallback && cache.get(key) === result) cache.delete(key);
    return response;
  });
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return result;
}
