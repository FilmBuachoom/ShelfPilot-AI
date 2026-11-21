"use client";

import { useMemo, useState } from "react";
import { AskBar } from "@/components/AskBar/AskBar";
import { editionLabels } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import { Dialog } from "@/components/Dialog";
import { FilterTabs } from "@/components/FilterTabs/FilterTabs";
import { SeriesRow } from "@/components/SeriesRow/SeriesRow";
import { ShelfHeader } from "@/components/ShelfHeader/ShelfHeader";
import { VolumeLegend } from "@/components/VolumeStrip/VolumeStrip";
import { useCatalog } from "@/lib/data/catalog-provider";
import { seriesKey, type ShelfSeries } from "@/lib/shelf/compute";
import { formatVolumes } from "@/lib/shelf/format";
import type { BookId, Edition } from "@/types/generated";
import { useAssistantPanel } from "./assistant/panel";

type Filter = "all" | "missing" | "upcoming" | Edition;

function matchesFilter(row: ShelfSeries, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "missing" || filter === "upcoming") return row[filter].length > 0;
  return row.edition === filter;
}

export function ShelfScreen() {
  const { collection: { series, stats }, searchCatalog } = useCatalog();
  const { aiEnabled, openAssistant } = useAssistantPanel();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const matchingIds = useMemo(() => new Set(searchCatalog(query)), [query, searchCatalog]);
  const searched = query.trim() ? series.filter((row) => row.volumes.some(({ book_id }) => matchingIds.has(book_id))) : series;
  const editions = (["manga", "light_novel", "special_set", "big_book"] as const)
    .filter((edition) => edition === "manga" || edition === "light_novel" || series.some((row) => row.edition === edition));
  const filters = [
    { id: "all", label: "ทั้งหมด" },
    ...editions.map((id) => ({ id, label: editionLabels[id] })),
    { id: "missing", label: "ขาดเล่ม" },
    { id: "upcoming", label: "ใกล้ออก" },
  ] as const;
  const tabs = filters.map((tab) => ({ ...tab, count: searched.filter((row) => matchesFilter(row, tab.id)).length }));
  const activeFilter = tabs.some(({ id }) => id === filter) ? filter : "all";
  const rows = searched.filter((row) => matchesFilter(row, activeFilter));

  return (
    <div className="sp-shelf-screen">
      <ShelfHeader stats={stats} query={query} onQueryChange={setQuery}
        onAdd={() => setAddOpen(true)} onStatClick={(value) => { setQuery(""); setFilter(value); }} />
      <FilterTabs tabs={tabs} value={activeFilter} onChange={setFilter} />
      {rows.length > 0 ? (
        <>
          <ul className="sp-series-list">
            {rows.map((row) => <SeriesRow key={seriesKey(row.seriesId, row.edition)} series={row} />)}
          </ul>
          <div className="sp-list-legend"><VolumeLegend /></div>
        </>
      ) : (
        <div className="sp-empty">
          <h2>{!query.trim() && activeFilter === "all" ? "คลังของคุณยังว่างอยู่" : "ไม่พบเรื่องในคลัง"}</h2>
          <p>{!query.trim() && activeFilter === "all"
            ? "กดเพิ่มเรื่องเพื่อเลือกเล่มที่คุณมีจากแค็ตตาล็อก"
            : "ลองเปลี่ยนตัวกรองหรือค้นหาด้วยชื่ออื่น"}</p>
        </div>
      )}
      {aiEnabled && <div className="sp-ask-footer"><AskBar /><AskBar onOpen={openAssistant} /></div>}
      {addOpen && <AddSeriesForm onClose={() => setAddOpen(false)} onAdded={() => { setQuery(""); setFilter("all"); }} />}
    </div>
  );
}

function AddSeriesForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { collection: { allSeries }, updateShelf, saving, saveError } = useCatalog();
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState<BookId[]>([]);
  const options = allSeries.filter(({ volumes }) => volumes.some(({ status }) => status !== "owned"))
    .sort((a, b) => a.representative.title.localeCompare(b.representative.title, "th"));
  const series = options.find((row) => seriesKey(row.seriesId, row.edition) === selected);

  return (
    <Dialog title="เพิ่มเรื่องเข้าคลัง" onDismiss={() => { if (!saving) onClose(); }}>
      {options.length === 0 ? (
        <>
          <p className="sp-muted">{allSeries.length === 0
            ? "ยังไม่พบในแค็ตตาล็อก ลองกลับมาเมื่อมีประกาศใหม่"
            : "เพิ่มหนังสือในแค็ตตาล็อกเข้าคลังครบแล้ว"}</p>
          <Button variant="ghost" size="block" onClick={onClose}>ปิด</Button>
        </>
      ) : (
        <form className="sp-form" onSubmit={async (event) => {
          event.preventDefault();
          if (checked.length && await updateShelf({ add: checked })) {
            onAdded();
            onClose();
          }
        }}>
          <label className="sp-field">
            <span>เลือกเรื่องและฉบับพิมพ์</span>
            <select value={selected} disabled={saving} onChange={(event) => {
              setSelected(event.target.value);
              setChecked([]);
            }}>
              <option value="">เลือกจากแค็ตตาล็อก</option>
              {options.map((row) => {
                const key = seriesKey(row.seriesId, row.edition);
                return <option key={key} value={key}>{row.representative.title} · {editionLabels[row.edition]}</option>;
              })}
            </select>
          </label>
          {series && <fieldset className="sp-checks">
            <legend>เลือกเล่มที่มี</legend>
            {series.volumes.filter(({ status }) => status !== "owned").map(({ book_id, volume }) => (
              <label key={book_id}>
                <input type="checkbox" checked={checked.includes(book_id)} disabled={saving} onChange={(event) => {
                  const next = event.target.checked;
                  setChecked((ids) => next ? [...ids, book_id] : ids.filter((id) => id !== book_id));
                }} />
                {formatVolumes(volume)}
              </label>
            ))}
          </fieldset>}
          {saveError && <p role="alert" className="sp-muted">{saveError}</p>}
          <div className="sp-modal__actions">
            <Button variant="action" size="block" type="submit" disabled={!checked.length || saving}>เพิ่ม {checked.length} เล่ม</Button>
            <Button variant="ghost" disabled={saving} onClick={onClose}>ยกเลิก</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
