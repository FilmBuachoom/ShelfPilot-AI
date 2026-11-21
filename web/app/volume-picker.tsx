"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { ShelfVolume } from "@/lib/shelf/compute";
import { formatVolumes } from "@/lib/shelf/format";
import type { BookId } from "@/types/generated";

export function VolumePicker({ volumes, checked, disabled, onToggle }: {
  volumes: ShelfVolume[];
  checked: BookId[];
  disabled: boolean;
  onToggle: (id: BookId) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = volumes.filter(row => checked.includes(row.book_id));

  function showOptions() {
    setOpen(true);
    requestAnimationFrame(() => {
      const menu = list.current;
      const first = menu?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?? menu?.querySelector<HTMLButtonElement>("button");
      first?.focus();
    });
  }

  return (
    <div className="sp-field sp-volume-picker" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label id={id + "-label"} htmlFor={id}>เลือกเล่มที่มี</label>
      <button id={id} ref={trigger} type="button" className="sp-volume-trigger" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={id + "-options"}
        aria-labelledby={id + "-label " + id + "-value"}
        onClick={() => open ? setOpen(false) : showOptions()}
        onKeyDown={event => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          showOptions();
        }}>
        <span id={id + "-value"}>{selected.length ? "เล่ม " + selected.map(row => row.volume).join(", ") : "เลือกเลขเล่ม"}</span>
        <Icon name="next" size={16} />
      </button>
      <div id={id + "-options"} ref={list} role="listbox" aria-labelledby={id + "-label"}
        aria-multiselectable="true" className="sp-volume-options" hidden={!open}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            trigger.current?.focus();
            return;
          }
          const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
          const i = buttons.indexOf(event.target as HTMLButtonElement);
          const positions: Record<string, number> = {
            ArrowDown: Math.min(i + 1, buttons.length - 1), ArrowUp: Math.max(0, i - 1),
            Home: 0, End: buttons.length - 1,
          };
          if (Object.hasOwn(positions, event.key)) {
            event.preventDefault();
            buttons[positions[event.key]]?.focus();
          }
        }}>
        {volumes.map(({ book_id, volume }) => (
          <button key={book_id} type="button" role="option" tabIndex={-1}
            aria-selected={checked.includes(book_id)} onClick={() => onToggle(book_id)}>
            {formatVolumes(volume)}
          </button>
        ))}
      </div>
    </div>
  );
}
