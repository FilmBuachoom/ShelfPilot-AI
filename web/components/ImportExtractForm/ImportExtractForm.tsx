"use client";

import { useRef, useState, type FormEvent } from "react";
import { Badge, EditionBadge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import type { MatchDecision, PipelineResult } from "@/lib/ingest/contracts";
import type { MatchStatus } from "@/types/generated";
import "./import.css";

const matchBadges = {
  duplicate_merged: { variant: "muted", label: "รวมประกาศซ้ำ" },
  distinct_edition: { variant: "info", label: "เพิ่มหนังสือ" },
  needs_review: { variant: "review", label: "ต้องตรวจสอบ" },
} as const satisfies Record<MatchStatus, { variant: "muted" | "info" | "review"; label: string }>;

function MatchDetails({ decision }: { decision: MatchDecision }) {
  const { variant, label } = matchBadges[decision.match_status];
  return <div className="sp-import__match">
    <Badge variant={variant}>{label}</Badge>
    {decision.candidate_book_id && <code>{decision.candidate_book_id}</code>}
    {decision.matched_alias && <span>ชื่อที่ตรงกัน · {decision.matched_alias}</span>}
    <span>{decision.reason}</span>
  </div>;
}

export function ImportExtractForm() {
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, source_url: sourceUrl, publisher_hint: publisher || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ กรุณาลองอีกครั้ง");
      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="sp-section sp-import" aria-labelledby="import-title">
      <h2 id="import-title">นำเข้าประกาศหนังสือ</h2>
      <p className="sp-muted">วางข้อความจากประกาศสำนักพิมพ์ที่ได้รับอนุญาต พร้อม URL ต้นทาง</p>
      <form className="sp-form" onSubmit={submit} aria-busy={pending}>
        <div className="sp-field">
          <label htmlFor="import-text">ข้อความประกาศ</label>
          <textarea id="import-text" required maxLength={30000} rows={5} value={rawText}
            onChange={(event) => setRawText(event.target.value)} disabled={pending}
            placeholder="วางข้อความประกาศที่นี่" />
        </div>
        <div className="sp-import__fields">
          <div className="sp-field">
            <label htmlFor="import-url">URL ต้นทาง</label>
            <input id="import-url" type="url" required maxLength={2048} value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)} disabled={pending} placeholder="https://…" />
          </div>
          <div className="sp-field">
            <label htmlFor="import-publisher">สำนักพิมพ์ <span className="sp-muted">(ไม่บังคับ)</span></label>
            <input id="import-publisher" type="text" maxLength={200} value={publisher}
              onChange={(event) => setPublisher(event.target.value)} disabled={pending} />
          </div>
        </div>
        <div className="sp-inline">
          <Button type="submit" variant="action" disabled={pending || !rawText.trim() || !sourceUrl.trim()}>
            {pending ? "กำลังประมวลผลประกาศ…" : "Import / Extract"}
          </Button>
        </div>
      </form>
      {error && <p className="sp-import__error" role="alert">{error}</p>}
      <div aria-live="polite" aria-atomic="true">
        {result && <section className="sp-import__result" aria-label="ผลการนำเข้าประกาศ">
          <div className="sp-import__result-head">
            <h3>ผลการนำเข้าประกาศ</h3>
            <Badge variant="muted">{result.status === "not_imported" ? "ยังไม่บันทึก" : "นำเข้าแล้ว"}</Badge>
          </div>
          <p>{result.message}</p>
          <p className="sp-import__source">source_id · <code>{result.source.source_id}</code></p>
          {result.extraction.items.length > 0 ? <div className="sp-import__scroll" role="region" aria-label="รายการที่สกัดได้" tabIndex={0}>
            <table><caption>สกัดได้ {result.extraction.items.length} รายการ</caption>
              <thead><tr><th scope="col">ชื่อเรื่อง</th><th scope="col">เล่ม</th><th scope="col">ฉบับ</th><th scope="col">วันวางจำหน่าย</th><th scope="col">ความละเอียดวันที่</th><th scope="col">ผลจับคู่</th></tr></thead>
              <tbody>{result.extraction.items.map((item, index) => <tr key={index}>
                <td>{item.title ?? "ไม่ระบุ"}</td><td>{item.volume ?? "ไม่ระบุ"}</td>
                <td>{item.edition ? <EditionBadge edition={item.edition} /> : <Badge variant="review">ไม่ระบุ</Badge>}</td>
                <td>{item.release_date ?? "ไม่ระบุวัน"}</td>
                <td>{{ day: "วัน", month: "เดือน", unknown: "ไม่ระบุ" }[item.release_date_precision]}</td>
                <td><MatchDetails decision={result.decisions[index]} /></td>
              </tr>)}</tbody>
            </table>
          </div> : result.status !== "already_imported" && <p>ไม่พบรายการเล่มหนังสือในข้อความ ลองตรวจข้อความต้นทางอีกครั้ง</p>}
        </section>}
      </div>
    </section>
  );
}
