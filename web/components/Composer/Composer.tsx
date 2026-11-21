import { useId, type Ref } from "react";
import { Icon } from "../icons";

export function Composer({
  value, onChange, onSend, inputRef, maxLength, disabled = false,
  placeholder = "ถามว่าเล่มไหนออกใหม่ หรือยังขาดเล่มไหน",
  hint = "ผู้ช่วยอ้างอิงหนังสือจากแค็ตตาล็อกของ ShelfPilot",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend?: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const hintId = useId();
  const message = value.trim();
  const excess = maxLength === undefined ? 0 : message.length - maxLength;
  const canSend = Boolean(onSend && message && !disabled && excess <= 0);
  return (
    <div>
      <form className="sp-composer" onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend?.(message);
      }}>
        <textarea ref={inputRef} rows={1} className="sp-composer__input" aria-label="ข้อความถึงผู้ช่วย"
          aria-describedby={hintId} placeholder={placeholder}
          maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
        <button className="sp-composer__send" type="submit" aria-label="ส่งข้อความ" disabled={!canSend}>
          <Icon name="send" size={20} />
        </button>
      </form>
      <div className="sp-composer__hint" id={hintId}>
        {excess > 0 ? `กรุณาลดข้อความอีก ${excess} ตัวอักษรเพื่อส่ง` : hint}
      </div>
    </div>
  );
}
