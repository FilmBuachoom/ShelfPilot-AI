import { useId, useState } from "react";
import type { Book, BookId, Edition, ReviewQueue } from "@/types/generated";
import { EDITION_CONFIDENCE_THRESHOLD } from "@/lib/ingest/constants";
import { reviewSource } from "@/lib/ingest/review-record";
import { EditionBadge, editionLabels } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { CitationEvidence } from "../CitationChip/CitationChip";

const editions = Object.keys(editionLabels) as Edition[];

type ReviewItem = ReviewQueue["items"][number];

export function ReviewQueueItem({
  item, selected, onSelect, onSkip, onCreate, onMerge, onResume, createReferences = [], pending = false,
}: {
  item: ReviewItem;
  selected?: BookId;
  onSelect: (book_id: BookId) => void;
  onSkip?: () => void;
  onCreate?: (edition: Edition, reference?: BookId) => void;
  onMerge?: () => void;
  onResume?: () => void;
  createReferences?: readonly Book[];
  pending?: boolean;
}) {
  const group = useId();
  const [edition, setEdition] = useState<Edition | "">("");
  const [reference, setReference] = useState<BookId>("");
  const referenceBook = createReferences.find(({ book_id }) => book_id === reference)
    ?? createReferences.find(({ book_id }) => book_id === selected)
    ?? (createReferences.length === 1 ? createReferences[0] : undefined);
  const title = item.extracted.title;
  const volume = item.extracted.volume;
  const confidence = Math.max(0, ...item.candidates.map((candidate) => candidate.confidence));
  const meter = confidence >= EDITION_CONFIDENCE_THRESHOLD ? "sp-conf__bar sp-conf__bar--verified" : "sp-conf__bar";
  return (
    <article className="sp-review" aria-busy={pending}>
      <header className="sp-review__head"><span>ต้องตรวจสอบ · {item.reason}</span><code>{item.review_id}</code></header>
      <div className="sp-review__grid">
        <div>
          {typeof title === "string" && <p><strong>{title}</strong>{typeof volume === "number" && ` · เล่ม ${volume}`}</p>}
          <CitationEvidence source_id={item.source_id} draftSource={reviewSource(item)} />
          {item.candidates.length > 0 && (
            <div className="sp-conf">
              <label htmlFor={`${group}-confidence`}>ความมั่นใจ {Math.round(confidence * 100)}%</label>
              <meter className={meter} id={`${group}-confidence`} min={0} max={1} value={confidence} />
            </div>
          )}
        </div>
        <fieldset className="sp-review__options" disabled={pending || !!onResume}>
          <legend className="sp-label">ฉบับที่อาจตรงกัน</legend>
          {item.candidates.length === 0 && <p className="sp-muted">ยังไม่พบฉบับที่ตรงกัน</p>}
          {item.candidates.map(({ book_id, edition, confidence }) => (
            <label key={book_id} className={`sp-option${selected === book_id ? " sp-option--selected" : ""}`}>
              <input type="radio" name={group} checked={selected === book_id} onChange={() => onSelect(book_id)} />
              <span className="sp-option__main"><EditionBadge edition={edition} /><code className="sp-option__id">{book_id}</code></span>
              <span className="sp-muted">{Math.round(confidence * 100)}%</span>
            </label>
          ))}
        </fieldset>
      </div>
      <footer className="sp-review__foot">
        {onResume ? (
          <Button size="sm" disabled={pending} onClick={onResume}>บันทึกการอนุมัติเดิมต่อ</Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" disabled={pending || !onSkip} onClick={onSkip}>ข้าม</Button>
            {onCreate && <div className="sp-field">
              <label htmlFor={`${group}-edition`}>ฉบับสำหรับรายการใหม่</label>
              <select id={`${group}-edition`} value={edition} disabled={pending}
                onChange={(event) => {
                  const value = editions.find((option) => option === event.currentTarget.value);
                  setEdition(value ?? "");
                }}>
                <option value="">เลือกฉบับ</option>
                {editions.map((value) => <option key={value} value={value}>{editionLabels[value]}</option>)}
              </select>
            </div>}
            {onCreate && createReferences.length > 1 && <div className="sp-field">
              <label htmlFor={`${group}-reference`}>เล่มอ้างอิงสำหรับรายการใหม่</label>
              <select id={`${group}-reference`} value={referenceBook?.book_id ?? ""} disabled={pending}
                onChange={(event) => setReference(event.currentTarget.value)}>
                <option value="">เลือกสายพิมพ์</option>
                {createReferences.map((book) => <option key={book.book_id} value={book.book_id}>
                  {book.title} · {editionLabels[book.edition]} · เล่ม {book.volume} · {book.publisher}
                </option>)}
              </select>
            </div>}
            <Button size="sm" disabled={pending || !onCreate || !edition || (createReferences.length > 1 && !referenceBook)}
              onClick={() => { if (edition) onCreate?.(edition, referenceBook?.book_id); }}>สร้างรายการใหม่</Button>
            <Button size="sm" disabled={pending || !onMerge || !selected} onClick={onMerge}>
              ตรวจและรวม
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}
