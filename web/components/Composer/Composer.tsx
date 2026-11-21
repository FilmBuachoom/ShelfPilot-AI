import { useId, type Ref } from "react";
import { Icon } from "../icons";

export function Composer({ value, onChange, onSend, inputRef, maxLength, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  onSend?: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  maxLength?: number;
  disabled?: boolean;
}) {
  const hint = useId();
  const message = value.trim();
  return (
    <div>
      <form className="sp-composer" onSubmit={(event) => {
        event.preventDefault();
        if (message && !disabled) onSend?.(message);
      }}>
        <textarea ref={inputRef} rows={1} className="sp-composer__input" aria-label="ข้อความถึงผู้ช่วย"
          aria-describedby={hint} placeholder="ถามว่าเล่มไหนออกใหม่ หรือยังขาดเล่มไหน"
          maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
        <button className="sp-composer__send" type="submit" aria-label="ส่งข้อความ" disabled={!onSend || !message || disabled}>
          <Icon name="send" size={20} />
        </button>
      </form>
      <div className="sp-composer__hint" id={hint}>ผู้ช่วยอ้างอิงหนังสือจากแค็ตตาล็อกของ ShelfPilot</div>
    </div>
  );
}
