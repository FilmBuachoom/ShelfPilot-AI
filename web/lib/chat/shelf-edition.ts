import "server-only";

import { normalizeTitle } from "@/lib/search/normalize";
import type { Edition } from "@/types/generated";
import type { ChatMessageInput } from "./shared";

const editionTerms: Record<Edition, RegExp> = {
  manga: /มังงะ|การ์ตูน|漫画|マンガ|\bmanga\b/i,
  light_novel: /นิยาย|(?:ไล(?:ต์|ท์)?\s*)?โนเวล|小説|ライトノベル|\b(?:light[ -])?novel\b/i,
  special_set: /ชุดพิเศษ|บ็อกซ์เซ็ต|บ๊อกซ์เซ็ต|特装版|\b(?:special[ -]set|box[ -]?set|set)\b/i,
  big_book: /บิ๊กบุ๊ก|บิ๊กบุ๊ค|\bbig[ -]?book\b/i,
};
const editions = Object.keys(editionTerms) as Edition[];

export function mentionsEdition(text: string) {
  return editions.some((edition) => editionTerms[edition].test(text));
}

function singleEdition(text: string) {
  const matches = editions.filter((edition) => editionTerms[edition].test(text));
  return matches.length === 1 ? matches[0] : undefined;
}

export function shelfEditionQuestion(title: string, options: string) {
  return `“${title}” หมายถึงฉบับไหน (${options})?`;
}

const replyFiller = /^(?:ฉบับ|the)?\s*(?:ค่ะ|ครับ|คะ|please)?[.!\s]*$/i;
const questionTitle = /^“(.+)” หมายถึงฉบับไหน \(.+\)\?$/u;

// Match catalog names before splitting clauses, so an "and" or edition word
// inside a title cannot split the title or supply evidence for its edition.
export function shelfEditionChoices(names: Set<string>, history: readonly ChatMessageInput[]) {
  const choices: { name: string; edition?: Edition }[] = [];
  if (!history.length || !names.size) return choices;

  const aliases = [...names].sort((a, b) => b.length - a.length);
  const escaped = aliases.map((name) => {
    const literal = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const left = /^[a-z0-9]/.test(name) ? "(?<![a-z0-9])" : "";
    const right = /[a-z0-9]$/.test(name) ? "(?![a-z0-9])" : "";
    return left + literal + right;
  });
  const separator = /\band\b|และ|กับ|[,+;&、，。]/u;
  const tokens = new RegExp(`(${escaped.join("|")})|${separator.source}`, "gu");

  // Only reuse turns connected by our own title-specific clarification.
  let first = history.length - 1;
  while (first >= 2 && history[first - 1].role === "assistant" && questionTitle.test(history[first - 1].content)
    && history[first - 2].role === "user") first -= 2;

  for (let turn = first; turn < history.length; turn += 2) {
    const text = normalizeTitle(history[turn].content.replace(/[\r\n]/g, ";"));
    const asked = history[turn - 1]?.content.match(questionTitle)?.[1];
    const shortAnswer = singleEdition(text);
    if (asked && shortAnswer && replyFiller.test(text.replace(editionTerms[shortAnswer], ""))) {
      choices.push({ name: normalizeTitle(asked), edition: shortAnswer });
      continue;
    }

    const clauses = [{ names: new Set<string>(), text: "" }];
    let clause = clauses[0];
    let end = 0;
    for (const match of text.matchAll(tokens)) {
      clause.text += text.slice(end, match.index) + " ";
      end = match.index + match[0].length;
      if (match[1]) clause.names.add(match[1]);
      else {
        clause = { names: new Set(), text: "" };
        clauses.push(clause);
      }
    }
    clause.text += text.slice(end);
    for (const part of clauses) {
      const edition = part.names.size === 1 ? singleEdition(part.text) : undefined;
      for (const name of part.names) choices.push({ name, edition });
    }
  }
  return choices;
}
