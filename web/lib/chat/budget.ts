import { computeShelf } from "@/lib/shelf/compute";
import type { Catalog, UserShelf } from "@/types/generated";
import type { ChatAnswer } from "@/types/generated/chat-answer";
import { answerQuick } from "./quick";
import type { ChatMessageInput } from "./shared";

const budgetRequest = /^(?:ช่วย\s*)?(?:จัดงบ(?:\s*ซื้อหนังสือ)?|งบ)\s*(.+?)\s*บาท[?!]?$/;
const priceQuote = /^ราคา\s+(.+)$/;
const money = /^(\d{1,9}|\d{1,3}(?:,\d{3}){1,2})(?:\.(\d{1,2}))?$/;
const thaiNumber = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const priceInstructions = "ส่งราคาที่ร้านแจ้งมาเพื่อเทียบงบ เช่น «ราคา 180 + 250 บาท»";

function satang(text: string): number | undefined {
  const normalized = text.trim().replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  const match = money.exec(normalized);
  if (!match) return undefined;
  const [, whole, fraction = ""] = match;
  return Number(whole.replaceAll(",", "")) * 100 + Number(fraction.padEnd(2, "0"));
}

function baht(amount: number) {
  return thaiNumber.format(amount / 100) + " บาท";
}

function requestedBudget(text: string) {
  const match = budgetRequest.exec(text);
  return match ? satang(match[1]) : undefined;
}

type BudgetTurn = { budget: number; quote?: string };

export function parseBudgetTurn(history: readonly ChatMessageInput[]): BudgetTurn | undefined {
  const userTurns = history.filter(({ role }) => role === "user").map(({ content }) => content);
  const latest = userTurns.pop();
  if (!latest) return undefined;

  const budget = requestedBudget(latest);
  if (budget !== undefined) return { budget };

  const quote = priceQuote.exec(latest);
  if (!quote) return undefined;
  const previousRequest = userTurns.reverse().find((turn) => !priceQuote.test(turn));
  const previousBudget = previousRequest === undefined ? undefined : requestedBudget(previousRequest);
  return previousBudget === undefined ? undefined : { budget: previousBudget, quote: quote[1] };
}

export function answerBudget(
  { budget, quote }: BudgetTurn, { catalog, shelf }: { catalog: Catalog; shelf: UserShelf },
): ChatAnswer {
  if (quote === undefined) {
    const { series } = computeShelf(catalog.books, shelf);
    const missing = answerQuick("missing", new Map(catalog.books.map((book) => [book.book_id, book])), series);
    const knownSources = new Set(catalog.sources.map(({ source_id }) => source_id));
    const suggestion = missing.book_ids.length ? " ดูเล่มที่ขาดในคลังจากการ์ดด้านล่างได้" : "";
    return {
      text: `งบ ${baht(budget)} แค็ตตาล็อกยังไม่มีราคาหนังสือ${suggestion}\n${priceInstructions}`,
      book_ids: missing.book_ids,
      source_ids: missing.source_ids.filter((id) => knownSources.has(id)),
      not_found: false,
      needs_clarification: true,
    };
  }

  const prices = quote.split("+").map((price) => satang(price.trim().replace(/\s*บาท$/, "")));
  const validPrices = prices.filter((price) => price !== undefined);
  const valid = validPrices.length === prices.length;
  let text = priceInstructions;
  if (valid) {
    const total = validPrices.reduce((sum, price) => sum + price, 0);
    const balance = budget - total;
    const result = balance < 0 ? `เกินงบ ${baht(-balance)}`
      : balance > 0 ? `เหลืองบ ${baht(balance)}` : "พอดีกับงบ";
    text = `รวมตามราคาที่คุณให้ ${baht(total)} จากงบ ${baht(budget)} ${result}`;
  }
  return { text, book_ids: [], source_ids: [], not_found: false, needs_clarification: !valid };
}
