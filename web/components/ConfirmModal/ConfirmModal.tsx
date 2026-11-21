import { useRef } from "react";
import { formatVolumes } from "@/lib/shelf/format";
import type { Book } from "@/types/generated";
import { EditionBadge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { Dialog } from "../Dialog";

export function ConfirmModal({ book, onConfirm, onCancel }: {
  book: Pick<Book, "title" | "volume" | "edition">;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmed = useRef(false);

  return (
    <Dialog title="ยืนยันก่อนไปหน้าร้าน" onDismiss={onCancel}>
      <p className="sp-modal__sub">ตรวจชื่อเรื่อง เลขเล่ม และฉบับพิมพ์</p>
      <dl className="sp-confirm">
        <dt>เรื่อง</dt><dd>{book.title}</dd>
        <dt>เล่ม</dt><dd>{formatVolumes(book.volume)}</dd>
        <dt>ฉบับ</dt><dd><EditionBadge edition={book.edition} /></dd>
      </dl>
      <div className="sp-modal__actions">
        <Button variant="action" size="block" onClick={() => {
          if (confirmed.current) return;
          confirmed.current = true;
          onConfirm();
        }}>ไปหน้าร้าน</Button>
        <Button variant="ghost" data-dialog-focus onClick={onCancel}>ยกเลิก</Button>
      </div>
      <p className="sp-modal__note">ร้านค้าจะเปิดในแท็บใหม่</p>
    </Dialog>
  );
}
