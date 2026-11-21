import type { ShelfSeries, ShelfVolume } from "./compute";

export function formatVolumeRange(start: number, end = start) {
  return start === end ? String(start) : `${start}–${end}`;
}

export function formatVolumes(start: number, end = start) {
  return `เล่ม ${formatVolumeRange(start, end)}`;
}

export function formatSeriesCount({ owned, missing, upcoming, total }: ShelfSeries) {
  const count = `${owned.length}/${total}`;
  if (missing.length) return `${count} · ขาด ${missing.map(({ volume }) => volume).join(", ")}`;
  if (upcoming.length) return `${count} · ใกล้ออก ${upcoming.length} เล่ม`;
  return `${count} · ครบแล้ว`;
}

export function formatVolumeCells(volumes: readonly ShelfVolume[], collapse = true) {
  const cells: { first: ShelfVolume; end: number }[] = [];

  for (const volume of volumes) {
    const previous = cells.at(-1);
    if (collapse && volumes.length > 30 && previous?.first.status === "owned"
      && volume.status === "owned" && Number.isInteger(previous.end)
      && volume.volume === previous.end + 1) {
      previous.end = volume.volume;
    } else {
      cells.push({ first: volume, end: volume.volume });
    }
  }

  return cells.map(({ first, end }) => ({
    ...first,
    label: first.volume === end ? String(end) : `${formatVolumeRange(first.volume, end)} ✓`,
    description: formatVolumes(first.volume, end),
    collapsed: first.volume !== end,
  }));
}
