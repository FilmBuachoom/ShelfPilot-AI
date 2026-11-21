"use client";

import { useState } from "react";
import { ImportExtractForm } from "@/components/ImportExtractForm/ImportExtractForm";
import { ReviewQueueItem } from "@/components/ReviewQueueItem/ReviewQueueItem";
import type { BookId, ReviewQueue } from "@/types/generated";

export function AdminScreen({ items }: { items: ReviewQueue["items"] }) {
  const [selected, setSelected] = useState<Record<string, BookId>>({});
  return (
    <div className="sp-screen sp-admin">
      <header className="sp-screen-head"><h1>แอดมิน</h1></header>
      <ImportExtractForm />
      <section className="sp-section">
        <h2>คิวตรวจสอบ</h2>
        {items.length === 0 && <p className="sp-muted">ไม่มีประกาศที่ต้องตรวจสอบ</p>}
        {items.map((item) => (
          <ReviewQueueItem key={item.review_id} item={item} selected={selected[item.review_id]}
            onSelect={(book_id) => setSelected((current) => ({ ...current, [item.review_id]: book_id }))} />
        ))}
      </section>
    </div>
  );
}
