import { notFound } from "next/navigation";
import { AI_ENABLED } from "@/lib/feature-flags";
import { BookShelfSection, type BookShelfItem } from "../book-shelf-section";

export default function RecommendPage() {
  if (!AI_ENABLED) notFound();
  return <Recommendations />;
}

function Recommendations({ next = [], similar = [] }: { next?: BookShelfItem[]; similar?: BookShelfItem[] }) {
  return (
    <div className="sp-feed">
      <header className="sp-feed-head"><h1>แนะนำ</h1></header>
      <BookShelfSection title="เล่มที่ควรเก็บต่อ" items={next} empty="ยังไม่มีเล่มที่แนะนำให้เก็บต่อ" />
      <BookShelfSection title="แนวเดียวกัน" items={similar} empty="ยังไม่มีเรื่องแนวเดียวกันที่แนะนำ" />
    </div>
  );
}
