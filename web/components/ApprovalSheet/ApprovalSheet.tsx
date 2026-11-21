"use client";

import { useId, useRef, useState } from "react";
import { useCatalog } from "@/lib/data/catalog-provider";
import { formatVolumeRange } from "@/lib/shelf/format";
import type { ShelfProposal } from "@/types/generated/chat-answer";
import { EditionBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { Cover } from "../Cover/Cover";

function formatDiff(values: number[]) {
  const ranges: { start: number; end: number }[] = [];
  for (const volume of [...values].sort((a, b) => a - b)) {
    const previous = ranges.at(-1);
    if (previous && Number.isInteger(previous.end) && volume === previous.end + 1) previous.end = volume;
    else ranges.push({ start: volume, end: volume });
  }
  return ranges.map(({ start, end }) => formatVolumeRange(start, end)).join(", ");
}

export function ApprovalSheet({ proposal, onConfirm, onCancel, onEdit }: {
  proposal: ShelfProposal;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const { books, collection, updateShelf, saving, saveError } = useCatalog();
  const titleId = useId();
  const submitting = useRef(false);
  const [failed, setFailed] = useState(false);
  const rows = proposal.items.map((item) => {
    const series = collection.allSeries.find((s) => s.seriesId === item.series_id && s.edition === item.edition);
    function resolve(ids: string[]) {
      return ids.flatMap((id) => {
        const book = books.get(id);
        return book?.series_id === item.series_id && book.edition === item.edition ? [book] : [];
      });
    }
    return { item, book: series?.representative, add: resolve(item.add), remove: resolve(item.remove) };
  });
  const count = rows.reduce((sum, row) => sum + row.add.length + row.remove.length, 0);
  const complete = count === proposal.total && rows.every(({ book, item, add, remove }) =>
    book && add.length === item.add.length && remove.length === item.remove.length);
  const verb = rows.every(({ remove }) => remove.length === 0) ? "เพิ่มลงคลัง" : "ปรับคลัง";
  async function confirm() {
    if (submitting.current || saving || !complete || !count) return;
    submitting.current = true;
    try {
      const saved = await updateShelf({
        add: rows.flatMap((row) => row.add.map((book) => book.book_id)),
        remove: rows.flatMap((row) => row.remove.map((book) => book.book_id)),
      });
      if (saved) onConfirm();
      else setFailed(true);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section className="sp-chat-proposal" aria-labelledby={titleId}>
      <h3 className="sp-sheet__title" id={titleId}>
        {count ? `${verb} ${count} เล่ม?` : "ไม่มีรายการที่ต้องปรับคลัง"}
      </h3>
      <p className="sp-sheet__sub">“{proposal.user_text}”</p>
      <ul className="sp-items">
        {rows.map(({ item, book, add, remove }) => (
          <li key={JSON.stringify([item.series_id, item.edition])} className="sp-item">
            {book && <Cover size="sheet" glyph={Array.from(book.title)[0] ?? ""} src={book.cover_url} />}
            <div className="sp-item__main">
              <span className="sp-item__title">{book?.title ?? "ไม่พบเรื่องนี้ในแค็ตตาล็อก"}</span>
              <div className="sp-item__meta"><EditionBadge edition={item.edition} /></div>
              {item.already_owned.length > 0 && <div>มีแล้ว {formatDiff(item.already_owned)}</div>}
              {item.not_owned.length > 0 && <div>ยังไม่มีในคลัง {formatDiff(item.not_owned)}</div>}
              {item.not_found_volumes.length > 0 && <div>ไม่พบในแค็ตตาล็อก {formatDiff(item.not_found_volumes)}</div>}
            </div>
            <span className="sp-diff">
              {add.length > 0 && <span>+ {formatDiff(add.map((b) => b.volume))}</span>}
              {remove.length > 0 && <span>− {formatDiff(remove.map((b) => b.volume))}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!complete && <p role="alert">แค็ตตาล็อกเปลี่ยนแล้ว กรุณาแก้ไขคำขอและตรวจรายการอีกครั้ง</p>}
      {failed && <p role="alert">{saveError || "บันทึกไม่สำเร็จ ลองอีกครั้ง"}</p>}
      <div className="sp-sheet__actions">
        <Button disabled={saving} onClick={onEdit}>แก้ไข</Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>ยกเลิก</Button>
        {count > 0 && <Button variant="action" disabled={saving || !complete} onClick={confirm}>
          ยืนยัน {count} เล่ม
        </Button>}
      </div>
    </section>
  );
}
