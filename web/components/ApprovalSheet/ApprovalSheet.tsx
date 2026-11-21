import type { Book, BookId } from "@/types/generated";
import { formatVolumeRange } from "@/lib/shelf/format";
import { EditionBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { Cover } from "../Cover/Cover";
import { Dialog } from "../Dialog";

type ApprovalRow = {
  book: Pick<Book, "book_id" | "title" | "edition" | "cover_url">;
  add: { book_id: BookId; volume: number }[];
  remove: { book_id: BookId; volume: number }[];
};

export type ApprovalProposal = { quote: string; rows: ApprovalRow[] };

function formatDiff(volumes: ApprovalRow["add"]) {
  const sorted = volumes.map(({ volume }) => volume).sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];
  for (const volume of sorted) {
    const previous = ranges.at(-1);
    if (previous && Number.isInteger(previous.end) && volume === previous.end + 1) previous.end = volume;
    else ranges.push({ start: volume, end: volume });
  }
  return ranges.map(({ start, end }) => formatVolumeRange(start, end)).join(", ");
}

export function ApprovalSheet({ proposal, pending = false, onConfirm, onEdit }: {
  proposal: ApprovalProposal;
  pending?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const count = proposal.rows.reduce((sum, row) => sum + row.add.length + row.remove.length, 0);
  const verb = proposal.rows.every(({ remove }) => remove.length === 0) ? "เพิ่มลงคลัง" : "ปรับคลัง";
  return (
    <Dialog variant="sheet" title={`${verb} ${count} เล่ม?`} onDismiss={onEdit}>
      <p className="sp-sheet__sub">“{proposal.quote}”</p>
      <ul className="sp-items">
        {proposal.rows.map(({ book, add, remove }) => (
          <li key={book.book_id} className="sp-item">
            <Cover size="sheet" glyph={Array.from(book.title)[0] ?? ""} src={book.cover_url} />
            <div className="sp-item__main">
              <span className="sp-item__title">{book.title}</span>
              <div className="sp-item__meta"><EditionBadge edition={book.edition} /></div>
            </div>
            <span className="sp-diff">
              {add.length > 0 && <span>+ {formatDiff(add)}</span>}
              {remove.length > 0 && <span>− {formatDiff(remove)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="sp-sheet__actions">
        <Button disabled={pending} onClick={onEdit}>แก้ไข</Button>
        <Button variant="action" size="block" disabled={pending || count === 0} onClick={onConfirm}>
          ยืนยัน {count} เล่ม
        </Button>
      </div>
    </Dialog>
  );
}
