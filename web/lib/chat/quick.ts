import type { ShelfSeries } from "@/lib/shelf/compute";
import { computeReleases, todayInBangkok } from "@/lib/shelf/releases";
import type { Book, BookId } from "@/types/generated";
import type { ChatAnswer } from "@/types/generated/chat-answer";

export type QuickAction = "missing" | "this_month" | "upcoming";

export function answerQuick(
  action: QuickAction,
  books: ReadonlyMap<BookId, Book>,
  series: readonly ShelfSeries[],
  today = todayInBangkok(),
): ChatAnswer {
  let matches: Book[];
  let summary: string;
  let empty: string;

  if (action === "missing") {
    matches = series.flatMap(({ missing }) => missing.flatMap(({ book_id }) => {
      const book = books.get(book_id);
      return book ? [book] : [];
    }));
    summary = "เล่มที่ขาดในชุดที่คุณสะสม";
    empty = "ยังไม่พบเล่มที่ขาดในชุดที่คุณสะสม ลองเพิ่มเล่มที่มีจากหน้าคลัง";
  } else if (action === "this_month") {
    matches = [...books.values()].filter(({ release_date, release_date_precision, sale_status }) =>
      sale_status === "released" && release_date?.slice(0, 7) === today.slice(0, 7)
      && (release_date_precision === "month" || release_date <= today),
    ).sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));
    summary = "เล่มที่วางจำหน่ายเดือนนี้";
    empty = "ยังไม่พบหนังสือออกใหม่เดือนนี้ในแค็ตตาล็อก ลองดูแท็บออกใหม่";
  } else {
    matches = computeReleases([...books.values()], today).upcoming.filter(({ release_date, release_date_precision }) => {
      if (!release_date) return false;
      const length = release_date_precision === "month" ? 7 : 10;
      return release_date.slice(0, length) >= today.slice(0, length);
    });
    summary = "เล่มที่กำลังจะวางจำหน่าย";
    empty = "ยังไม่พบกำหนดวางจำหน่ายใหม่ในแค็ตตาล็อก ลองดูแท็บออกใหม่";
  }

  const shown = matches.slice(0, 8);
  const more = shown.length < matches.length ? " แสดง " + shown.length + " เล่มแรก" : "";
  return {
    text: matches.length ? summary + " " + matches.length + " เล่ม" + more : empty,
    book_ids: shown.map(({ book_id }) => book_id),
    source_ids: [...new Set(shown.flatMap(({ sources }) => sources))],
    not_found: matches.length === 0,
    needs_clarification: false,
  };
}
