"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button/Button";
import { useCatalog } from "@/lib/data/catalog-provider";
import { personalReleases } from "@/lib/recommend/candidates";
import { catalogVersion, type RecommendationResponse } from "@/lib/recommend/contracts";
import { BookShelfSection } from "../book-shelf-section";

export function RecommendScreen({ today }: { today: string }) {
  const { books, catalogUpdatedAt, collection, shelf } = useCatalog();
  const version = catalogVersion(catalogUpdatedAt, books.size);
  const ownedIds = shelf.owned.map(({ book_id }) => book_id).sort();

  return (
    <RecommendationResults key={JSON.stringify([version, ownedIds])} catalogRevision={version} today={today}>
      {collection.stats.missing > 0 && (
        <p className="sp-feed-empty">ยังขาด {collection.stats.missing} เล่มในเรื่องที่คุณเก็บ</p>
      )}
      <BookShelfSection title="ออกใหม่ของเรื่องที่คุณเก็บ"
        items={personalReleases(books.values(), collection.series, today)} today={today}
        empty="ยังไม่พบเล่มออกใหม่หรือใกล้วางแผงในเรื่องที่คุณเก็บ" />
    </RecommendationResults>
  );
}

type RequestResult = { number: number; error?: true; data?: RecommendationResponse };

function RecommendationResults({ catalogRevision, today, children }: {
  catalogRevision: string;
  today: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [requestNumber, setRequestNumber] = useState(0);
  const [result, setResult] = useState<RequestResult>();
  const loading = result?.number !== requestNumber;
  const catalogChanged = result?.data !== undefined && result.data.catalogVersion !== catalogRevision;
  const data = catalogChanged ? undefined : result?.data;

  useEffect(() => {
    const controller = new AbortController();
    const options: RequestInit = { signal: controller.signal, cache: "no-store" };
    if (requestNumber > 0) {
      options.method = "POST";
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify({ refresh: true });
    }

    async function load() {
      try {
        const response = await fetch("/api/recommend", options);
        if (!response.ok) throw new Error("Recommendation request failed");
        const data = await response.json() as RecommendationResponse;
        if (controller.signal.aborted) return;
        setResult({ number: requestNumber, data });
        // Navigation can reuse an older layout. Refresh it before hydrating new IDs.
        if (data.catalogVersion !== catalogRevision) router.refresh();
      } catch {
        if (!controller.signal.aborted) {
          setResult((previous) => ({ number: requestNumber, error: true, data: previous?.data }));
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [requestNumber, catalogRevision, router]);

  return (
    <div className="sp-feed">
      <header className="sp-feed-head sp-recommend-head">
        <h1>แนะนำ</h1>
        <Button disabled={loading} onClick={() => setRequestNumber((current) => current + 1)}>
          อัปเดตคำแนะนำ
        </Button>
      </header>
      {children}
      {loading || (catalogChanged && !result?.error)
        ? <p className="sp-feed-empty" role="status">กำลังโหลดคำแนะนำ</p>
        : result?.error
          ? <p className="sp-feed-empty" role="status">โหลดคำแนะนำไม่สำเร็จ ลองกดอัปเดตคำแนะนำอีกครั้ง</p>
          : data?.fallback && (
            <p className="sp-feed-empty" role="status">AI ยังไม่พร้อมใช้งาน กำลังแสดงรายการจากแค็ตตาล็อก</p>
          )}
      {data && (
        <>
          <BookShelfSection title="เล่มที่ควรเก็บต่อ" items={data.continue} today={today}
            empty="ยังไม่มีเล่มที่แนะนำให้เก็บต่อ" />
          <BookShelfSection title="แนวเดียวกัน" items={data.similar} today={today}
            empty="ยังไม่มีเรื่องแนวเดียวกันที่แนะนำ" />
        </>
      )}
    </div>
  );
}
