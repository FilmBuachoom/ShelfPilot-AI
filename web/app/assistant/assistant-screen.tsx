"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ApprovalSheet } from "@/components/ApprovalSheet/ApprovalSheet";
import { ChatMessage } from "@/components/ChatMessage/ChatMessage";
import { Composer } from "@/components/Composer/Composer";
import { QuickChip } from "@/components/QuickChip/QuickChip";

type Message = ComponentProps<typeof ChatMessage> & { id: string };

const quickChips = [
  { label: "เล่มที่ขาด", zeroToken: true },
  { label: "ออกใหม่เดือนนี้", zeroToken: true },
  { label: "จัดงบ 500 บาท", zeroToken: false },
];

export function AssistantScreen({ messages = [], approval, onSend, onQuick }: {
  messages?: Message[];
  approval?: ComponentProps<typeof ApprovalSheet>;
  onSend?: (message: string) => void;
  onQuick?: (label: string, zeroToken: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  return (
    <div className="sp-assistant">
      {messages.length > 0 ? (
        <div className="sp-chat" role="log" aria-label="บทสนทนา">
          {messages.map(({ id, ...message }) => <ChatMessage key={id} {...message} />)}
        </div>
      ) : (
        <div className="sp-assistant-empty">
          <h1>วันนี้อยากเช็กชั้นไหน?</h1>
          {!onSend && <p className="sp-muted">แชทยังไม่เปิดใช้งาน คุณจัดการหนังสือได้จากคลังของฉัน</p>}
        </div>
      )}
      <div className="sp-assistant-input">
        <div className="sp-chips">
          {quickChips.map(({ label, zeroToken }) => (
            <QuickChip key={label} label={label} zeroToken={zeroToken}
              onClick={onQuick ? () => onQuick(label, zeroToken) : undefined} />
          ))}
        </div>
        <Composer inputRef={input} value={draft} onChange={setDraft} onSend={onSend && ((message) => {
          onSend(message);
          setDraft("");
        })} />
      </div>
      {approval && <ApprovalSheet {...approval} />}
    </div>
  );
}
