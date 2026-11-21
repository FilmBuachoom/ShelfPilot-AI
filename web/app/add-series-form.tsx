"use client";

import { useState } from "react";
import { SeriesPicker } from "./series-picker";
import { Button } from "@/components/Button/Button";
import { Dialog } from "@/components/Dialog";
import { useCatalog } from "@/lib/data/catalog-provider";
import { seriesKey } from "@/lib/shelf/compute";
import { VolumePicker } from "./volume-picker";
import type { BookId } from "@/types/generated";

export function AddSeriesForm({ onClose, onAdded }: { onClose: () => void; onAdded?: () => void }) {
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
        <form className="sp-form sp-add-series" onSubmit={async (event) => {
          event.preventDefault();
          if (checked.length && await updateShelf({ add: checked })) {
            onAdded?.();
            onClose();
          }
        }}>
          <SeriesPicker options={options} selected={series} disabled={saving} onChange={(row) => {
            setSelected(row ? seriesKey(row.seriesId, row.edition) : "");
            setChecked([]);
          }} />
          {series && <VolumePicker key={selected} volumes={series.volumes.filter(row => row.status !== "owned")}
            checked={checked} disabled={saving} onToggle={id => {
              setChecked(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
            }} />}
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
