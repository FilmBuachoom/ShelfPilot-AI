"use client";

import { useMemo, useState } from "react";
import { AskBar } from "@/components/AskBar/AskBar";
import { editionLabels } from "@/components/Badge/Badge";
import { FilterTabs } from "@/components/FilterTabs/FilterTabs";
import { SeriesRow } from "@/components/SeriesRow/SeriesRow";
import { ShelfHeader } from "@/components/ShelfHeader/ShelfHeader";
import { VolumeLegend } from "@/components/VolumeStrip/VolumeStrip";
import { useCatalog } from "@/lib/data/catalog-provider";
import { seriesKey, type ShelfSeries } from "@/lib/shelf/compute";
import type { Edition } from "@/types/generated";
import { AddSeriesForm } from "./add-series-form";
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
