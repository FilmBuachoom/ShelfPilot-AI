"use client";

import { useEffect, useId, useRef, useState } from "react";
import { editionLabels } from "@/components/Badge/Badge";
import { useCatalog } from "@/lib/data/catalog-provider";
import { seriesKey, type ShelfSeries } from "@/lib/shelf/compute";

function label(row: ShelfSeries) {
  return row.representative.title + " · " + editionLabels[row.edition];
}

export function SeriesPicker({ options, selected, disabled, onChange }: {
  options: ShelfSeries[];
  selected?: ShelfSeries;
  disabled: boolean;
  onChange: (row?: ShelfSeries) => void;
}) {
  const { searchCatalog } = useCatalog();
  const id = useId();
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ranks = new Map(searchCatalog(query).map((bookId, rank) => [bookId, rank]));
  const results = query.trim() ? options.map(row => ({
    row, rank: Math.min(...row.volumes.map(v => ranks.get(v.book_id) ?? Infinity)),
  })).filter(item => Number.isFinite(item.rank)).sort((a, b) => a.rank - b.rank).map(item => item.row) : options;

  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(row: ShelfSeries) {
    if (row !== selected) onChange(row);
    setQuery("");
    setActive(-1);
    setOpen(false);
  }

  return (
    <div className="sp-field sp-series-picker">
      <label htmlFor={id}>เลือกเรื่องและฉบับพิมพ์</label>
      <input id={id} type="text" role="combobox" autoComplete="off" disabled={disabled}
        placeholder="ค้นหาชื่อเรื่องหรือชื่อย่อ" value={selected ? label(selected) : query}
        aria-autocomplete="list" aria-expanded={open} aria-controls={id + "-list"}
        aria-activedescendant={open && results[active] ? id + "-" + active : undefined}
        onFocus={event => { event.target.select(); setOpen(true); }}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1); }}
        onChange={event => {
          onChange();
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const last = results.length - 1;
            setActive(event.key === "ArrowDown" ? Math.min(active + 1, last) : active < 0 ? last : Math.max(0, active - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const row = active >= 0 ? results[active] : selected ?? results[0];
            if (open && row) choose(row);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }} />
      <ul ref={list} id={id + "-list"} role="listbox" aria-label="เรื่องและฉบับพิมพ์"
        className="sp-series-options" hidden={!open || !results.length}>
        {results.map((row, i) => (
          <li key={seriesKey(row.seriesId, row.edition)} id={id + "-" + i} role="option"
            aria-selected={row === selected} data-active={i === active}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(row)}>
            {label(row)}
          </li>
        ))}
      </ul>
      {open && !results.length && <span className="sp-series-options sp-series-empty sp-muted" role="status">ไม่พบเรื่องที่ค้นหา</span>}
    </div>
  );
}
