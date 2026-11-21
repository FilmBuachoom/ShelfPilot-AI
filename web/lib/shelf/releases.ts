import type { Book } from "@/types/generated";

const bangkokDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const thaiDay = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const thaiMonth = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

export function todayInBangkok(now = new Date()) {
  return bangkokDate.format(now);
}

export function formatReleaseDate(book: Pick<Book, "release_date" | "release_date_precision">) {
  if (!book.release_date) return "";
  const date = new Date(`${book.release_date}T00:00:00Z`);
  return (book.release_date_precision === "day" ? thaiDay : thaiMonth).format(date);
}

export function formatSourceDate(date: string) {
  return thaiDay.format(new Date(date));
}

function releaseKey(book: Book) {
  return book.release_date?.slice(0, book.release_date_precision === "day" ? 10 : 7) ?? "";
}

export function computeReleases(books: readonly Book[], today: string) {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const upcoming = books.filter(({ sale_status }) => sale_status !== "released")
    .sort((a, b) => (releaseKey(a) || "9999").localeCompare(releaseKey(b) || "9999"));
  const recent = books.filter((book) => {
    if (book.sale_status !== "released" || !book.release_date) return false;
    const length = releaseKey(book).length;
    return releaseKey(book) >= cutoffDay.slice(0, length) && releaseKey(book) <= today.slice(0, length);
  }).sort((a, b) => releaseKey(b).localeCompare(releaseKey(a)));

  return { upcoming, recent };
}

export function daysUntilRelease(book: Book, today: string) {
  if (!book.release_date || book.release_date_precision !== "day" || book.sale_status === "released") return null;
  const days = (Date.parse(book.release_date) - Date.parse(today)) / 86_400_000;
  return days >= 0 ? days : null;
}
