import { BookShelfSection } from "../book-shelf-section";
import { readCatalog } from "@/lib/data/store";
import { computeReleases, todayInBangkok } from "@/lib/shelf/releases";

export default async function NewReleasesPage() {
  const { books } = await readCatalog();
  const today = todayInBangkok();
  const { upcoming, recent } = computeReleases(books, today);
  return (
    <div className="sp-feed">
      <header className="sp-feed-head"><h1>ออกใหม่</h1></header>
      <BookShelfSection title="ใกล้วางแผง" items={upcoming} today={today}
        empty="ยังไม่พบกำหนดวางแผงในแค็ตตาล็อก" />
      <BookShelfSection title="วางแผงล่าสุด" items={recent} today={today}
        empty="ยังไม่พบหนังสือที่วางแผงในช่วง 30 วันที่ผ่านมา" />
    </div>
  );
}
