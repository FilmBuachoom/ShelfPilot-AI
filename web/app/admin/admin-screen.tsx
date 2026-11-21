"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge } from "@/components/Badge/Badge";
import { ImportExtractForm } from "@/components/ImportExtractForm/ImportExtractForm";
import { ReviewQueueItem } from "@/components/ReviewQueueItem/ReviewQueueItem";
import type { ReviewResolution } from "@/lib/ingest/contracts";
import { canCreateFromReview, pendingReviewResolution, reviewSource } from "@/lib/ingest/review-record";
import type { BookId, ReviewQueue } from "@/types/generated";

export function AdminScreen({ items, canManageIngest }: {
  items: ReviewQueue["items"];
  canManageIngest: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, BookId>>({});
  const [resolved, setResolved] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const openItems = items.filter(({ review_id }) => !resolved.includes(review_id));

  async function approve(resolution: ReviewResolution) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setPending(resolution.review_id);
    try {
      const response = await fetch("/api/review/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resolution),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "resolved") {
        setError(result.error ?? "บันทึกผลการตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง");
        router.refresh();
        return;
      }
      setResolved((current) => [...current, resolution.review_id]);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      router.refresh();
    } finally {
      setPending(null);
      inFlight.current = false;
    }
  }

  return (
    <div className="sp-screen sp-admin">
      <header className="sp-screen-head"><h1>แอดมิน</h1></header>
      {canManageIngest ? <ImportExtractForm onImported={() => router.refresh()} /> : (
        <section className="sp-section">
          <h2>นำเข้าประกาศหนังสือ</h2>
          <p className="sp-muted">Import / Extract ใช้งานได้บนเซิร์ฟเวอร์ทดลองในเครื่องที่ใช้แค็ตตาล็อกแบบไฟล์</p>
        </section>
      )}
      <section className="sp-section">
        <div className="sp-inline">
          <h2>คิวตรวจสอบ</h2>
          <Badge variant={openItems.length ? "review" : "muted"}>{openItems.length} รายการ</Badge>
        </div>
        {error && <p role="alert">{error}</p>}
        {openItems.length === 0 && <p className="sp-muted">ไม่มีประกาศที่ต้องตรวจสอบ</p>}
        {openItems.map((item) => {
          const id = item.review_id;
          const saved = pendingReviewResolution(item);
          const book_id = saved && "book_id" in saved ? saved.book_id : selected[id];
          const canDecide = canManageIngest && !saved;
          return <ReviewQueueItem key={id} item={item} selected={book_id} pending={pending === id}
            onSelect={(idOfBook) => setSelected((current) => ({ ...current, [id]: idOfBook }))}
            onSkip={canDecide ? () => approve({ review_id: id, action: "skip" }) : undefined}
            onCreate={canDecide && canCreateFromReview(item)
              ? (edition) => approve({ review_id: id, action: "create", edition, book_id }) : undefined}
            onMerge={canDecide && reviewSource(item) && book_id
              ? () => approve({ review_id: id, action: "merge", book_id }) : undefined}
            onResume={canManageIngest && saved ? () => approve(saved) : undefined} />;
        })}
      </section>
    </div>
  );
}
