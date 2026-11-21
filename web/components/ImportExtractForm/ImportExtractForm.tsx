"use client";

import { useRef, useState, type FormEvent } from "react";
import type { PipelineResult } from "@/lib/ingest/contracts";
import "./design.css";
import "./import.css";

const editionLabels = {
  manga: "มังงะ", light_novel: "นิยาย", special_set: "บ็อกซ์เซ็ต", big_book: "บิ๊กบุ๊ก",
};

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
    <section className="sp-import" aria-labelledby="import-title">
      <header className="sp-import__header">
        <p className="sp-import__eyebrow">ShelfPilot · Admin</p>
        <h1 id="import-title">นำเข้าประกาศหนังสือ</h1>
        <p>วางข้อความจากประกาศสำนักพิมพ์ที่ได้รับอนุญาต พร้อม URL ต้นทาง</p>
      </header>
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="import-text">ข้อความประกาศ</label>
        <textarea id="import-text" required maxLength={30000} rows={8} value={rawText}
          onChange={(event) => setRawText(event.target.value)} disabled={pending}
          placeholder="วางข้อความประกาศที่นี่" />
        <div className="sp-import__fields">
          <div><label htmlFor="import-url">URL ต้นทาง</label>
            <input id="import-url" type="url" required maxLength={2048} value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)} disabled={pending} placeholder="https://…" /></div>
          <div><label htmlFor="import-publisher">สำนักพิมพ์ <span>(ไม่บังคับ)</span></label>
            <input id="import-publisher" maxLength={200} value={publisher}
              onChange={(event) => setPublisher(event.target.value)} disabled={pending} /></div>
        </div>
        <button type="submit" className="sp-btn sp-btn--action" disabled={pending}>
          {pending ? "กำลังสกัดข้อมูล…" : "Import / Extract"}
        </button>
      </form>
      {error && <p className="sp-import__error" role="alert">{error}</p>}
      <div aria-live="polite" aria-atomic="true">
        {result && <section className="sp-import__result" aria-label="ผลการสกัดข้อมูล">
          <div className="sp-import__result-head">
            <h2>ผลการสกัดข้อมูล</h2>
            <span className="sp-badge sp-badge--muted">{result.status === "dry_run" ? "ยังไม่บันทึก" : "นำเข้าแล้ว"}</span>
          </div>
          <p>{result.message}</p>
          <p className="sp-import__source">source_id · <code>{result.source.source_id}</code></p>
          {result.extraction.items.length > 0 ? <div className="sp-import__scroll" role="region" aria-label="รายการที่สกัดได้" tabIndex={0}>
            <table><caption>สกัดได้ {result.extraction.items.length} รายการ</caption>
              <thead><tr><th scope="col">ชื่อเรื่อง</th><th scope="col">เล่ม</th><th scope="col">ฉบับ</th><th scope="col">วันวางจำหน่าย</th><th scope="col">ความละเอียดวันที่</th></tr></thead>
              <tbody>{result.extraction.items.map((item, index) => <tr key={index}>
                <td>{item.title ?? "ไม่ระบุ"}</td><td>{item.volume ?? "ไม่ระบุ"}</td>
                <td><span className={`sp-badge ${item.edition ? "sp-badge--edition" : "sp-badge--review"}`}>{item.edition ? editionLabels[item.edition] : "ไม่ระบุ"}</span></td>
                <td>{item.release_date ?? "ไม่ระบุวัน"}</td>
                <td>{{ day: "วัน", month: "เดือน", unknown: "ไม่ระบุ" }[item.release_date_precision]}</td>
              </tr>)}</tbody>
            </table>
          </div> : result.status !== "already_imported" && <p>ไม่พบรายการเล่มหนังสือในข้อความ ลองตรวจข้อความต้นทางอีกครั้ง</p>}
        </section>}
      </div>
    </section>
  );
}
