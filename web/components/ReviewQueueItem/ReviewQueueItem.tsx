import { useId } from "react";
import type { BookId, ReviewQueue } from "@/types/generated";
import { EditionBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { CitationEvidence } from "../CitationChip/CitationChip";

const MATCH_CONFIDENCE_THRESHOLD = 0.8;

type ReviewItem = ReviewQueue["items"][number];

export function ReviewQueueItem({ item, selected, onSelect, onSkip, onCreate, onMerge, primary = false }: {
  item: ReviewItem;
  selected?: BookId;
  onSelect: (book_id: BookId) => void;
  onSkip?: () => void;
  onCreate?: () => void;
  onMerge?: () => void;
  primary?: boolean;
}) {
  const group = useId();
  const confidence = Math.max(0, ...item.candidates.map((candidate) => candidate.confidence));
  const meter = confidence >= MATCH_CONFIDENCE_THRESHOLD ? "sp-conf__bar sp-conf__bar--verified" : "sp-conf__bar";
  return (
    <article className="sp-review">
      <header className="sp-review__head"><span>ต้องตรวจสอบ · {item.reason}</span><code>{item.review_id}</code></header>
      <div className="sp-review__grid">
        <div>
          <CitationEvidence source_id={item.source_id} />
          {item.candidates.length > 0 && (
            <div className="sp-conf">
              <label htmlFor={`${group}-confidence`}>ความมั่นใจ {Math.round(confidence * 100)}%</label>
              <meter className={meter} id={`${group}-confidence`} min={0} max={1} value={confidence} />
            </div>
          )}
        </div>
        <fieldset className="sp-review__options">
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
        <Button variant="ghost" size="sm" disabled={!onSkip} onClick={onSkip}>ข้าม</Button>
        <Button size="sm" disabled={!onCreate} onClick={onCreate}>สร้างรายการใหม่</Button>
        <Button variant={primary ? "action" : "default"} size="sm" disabled={!onMerge || !selected} onClick={onMerge}>
          ตรวจและรวม
        </Button>
      </footer>
    </article>
  );
}
