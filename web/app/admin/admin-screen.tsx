"use client";

import { useState } from "react";
import { Button } from "@/components/Button/Button";
import { ReviewQueueItem } from "@/components/ReviewQueueItem/ReviewQueueItem";
import type { BookId, ReviewQueue } from "@/types/generated";

export function AdminScreen({ items, onImport }: {
  items: ReviewQueue["items"];
  onImport?: (text: string) => void;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Record<string, BookId>>({});
  return (
    <div className="sp-screen sp-admin">
      <header className="sp-screen-head"><h1>แอดมิน</h1></header>
      <section className="sp-section">
        <h2>นำเข้าประกาศ</h2>
        <form className="sp-form" onSubmit={(event) => {
          event.preventDefault();
          if (announcement.trim()) onImport?.(announcement.trim());
        }}>
          <label className="sp-field">
            <span>ข้อความประกาศจากสำนักพิมพ์</span>
            <textarea rows={5} value={announcement} placeholder="วางข้อความประกาศ"
              onChange={(event) => setAnnouncement(event.target.value)} />
          </label>
          <div className="sp-inline">
            <Button variant="action" type="submit" disabled={!onImport || !announcement.trim()}>
              Import / Extract
            </Button>
            {!onImport && <span className="sp-muted">ระบบดึงข้อมูลยังไม่เปิดใช้งาน</span>}
          </div>
        </form>
      </section>
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
