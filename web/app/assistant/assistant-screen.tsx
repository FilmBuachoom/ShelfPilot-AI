"use client";

import { useEffect, useRef, useState, type ComponentProps, type RefObject } from "react";
import { ApprovalSheet } from "@/components/ApprovalSheet/ApprovalSheet";
import { ChatMessage } from "@/components/ChatMessage/ChatMessage";
import { Composer } from "@/components/Composer/Composer";
import { QuickChip } from "@/components/QuickChip/QuickChip";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/shared";
import type { ShelfProposal } from "@/types/generated/chat-answer";
import type { QuickAction } from "@/lib/chat/quick";

type Message = ComponentProps<typeof ChatMessage> & { id: number; proposal?: ShelfProposal };

const addRequestPrefix = "เพิ่มหนังสือเข้าคลัง: ";

const quickChips: { label: string; action: QuickAction }[] = [
  { label: "เล่มที่ขาด", action: "missing" },
  { label: "ออกใหม่เดือนนี้", action: "this_month" },
  { label: "ใกล้ออก", action: "upcoming" },
];

export function AssistantScreen({ inputRef, messages = [], finishProposal, pending = false, revealId, onRevealComplete, onSend, onQuick }: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  messages?: Message[];
  finishProposal?: (outcome: "confirmed" | "cancelled" | "editing") => void;
  onSend?: (message: string) => void;
  onQuick?: (label: string, action?: QuickAction) => void;
  pending?: boolean;
  revealId?: number;
  onRevealComplete?: (id: number) => void;
}) {
  const reviewing = Boolean(messages.at(-1)?.proposal);
  const [addingBooks, setAddingBooks] = useState(false);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = log.current;
    if (!container) return;
    const latest = container.lastElementChild;
    if (latest && latest.clientHeight > container.clientHeight) {
      container.scrollTop += latest.getBoundingClientRect().top - container.getBoundingClientRect().top;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, pending, revealId, reviewing]);

  return (
    <div className="sp-assistant">
      {messages.length > 0 ? (
        <div ref={log} className="sp-chat" role="log" aria-label="บทสนทนา" tabIndex={0}>
          {messages.map(({ id, proposal, ...message }) => (
            <ChatMessage key={id} {...message}
              reveal={id === revealId && onRevealComplete ? { id, onComplete: onRevealComplete } : undefined}>
              {proposal && finishProposal && <ApprovalSheet proposal={proposal}
                onConfirm={() => finishProposal("confirmed")}
                onCancel={() => finishProposal("cancelled")}
                onEdit={() => {
                  const addRequest = proposal.user_text.startsWith(addRequestPrefix);
                  setAddingBooks(addRequest);
                  setDraft(addRequest ? proposal.user_text.slice(addRequestPrefix.length) : proposal.user_text);
                  finishProposal("editing");
                  requestAnimationFrame(() => inputRef.current?.focus());
                }} />}
            </ChatMessage>
          ))}
          {pending && <p className="sp-muted" role="status">ผู้ช่วยกำลังค้นข้อมูล…</p>}
        </div>
      ) : (
        <div className="sp-assistant-empty">
          <h1>วันนี้อยากเช็กชั้นไหน?</h1>
          {!onSend && <p className="sp-muted">แชทยังไม่เปิดใช้งาน คุณจัดการหนังสือได้จากคลังของฉัน</p>}
        </div>
      )}
      <div className="sp-assistant-input">
        <div className="sp-chips">
          {quickChips.map(({ label, action }) => (
            <QuickChip key={label} label={label}
              onClick={onQuick && !pending && !reviewing ? () => onQuick(label, action) : undefined} />
          ))}
          <button type="button" className="sp-chip" aria-pressed={addingBooks} disabled={!onSend || pending || reviewing}
            onClick={() => {
              setAddingBooks(!addingBooks);
              inputRef.current?.focus();
            }}>เพิ่มหนังสือ</button>
        </div>
        <Composer
          disabled={pending || reviewing}
          placeholder={addingBooks ? "เช่น เพิ่งซื้อ OVER LORD เล่ม 18" : undefined}
          hint={addingBooks ? "พิมพ์ชื่อเรื่องและเลขเล่ม แล้วตรวจรายการก่อนยืนยันเข้าคลัง" : undefined}
          maxLength={MAX_MESSAGE_LENGTH - (addingBooks ? addRequestPrefix.length : 0)}
          inputRef={inputRef}
          value={draft}
          onChange={setDraft}
          onSend={onSend && ((message) => {
            onSend(addingBooks ? addRequestPrefix + message : message);
            setAddingBooks(false);
            setDraft("");
          })}
        />
      </div>
    </div>
  );
}
