"use client";

import { useState } from "react";
import type { ShelfVolume } from "@/lib/shelf/compute";
import { formatVolumeCells } from "@/lib/shelf/format";
import type { BookId } from "@/types/generated";
import { Button } from "../Button/Button";

const statusLabels = { owned: "มีแล้ว", missing: "ขาด", upcoming: "ใกล้ออก" };

export function VolumeStrip({ volumes, size = "default", onToggle, disabled = false }: {
  volumes: readonly ShelfVolume[];
  size?: "sm" | "default" | "lg";
  onToggle?: (id: BookId) => void;
  disabled?: boolean;
}) {
  const interactive = size === "lg" && onToggle;
  const [expanded, setExpanded] = useState(false);
  const collapsedCells = formatVolumeCells(volumes);
  const cells = expanded ? formatVolumeCells(volumes, false) : collapsedCells;
  const canExpand = interactive && collapsedCells.some(({ collapsed }) => collapsed);
  return (
    <>
      <div className={size === "default" ? "sp-vols" : `sp-vols sp-vols--${size}`} role="group" aria-label="สถานะเล่ม">
        {cells.map(({ book_id, label, description, status, collapsed }) => {
          const className = `sp-vol sp-vol--${status}${collapsed ? " sp-vol--range" : ""}`;
          return interactive && !collapsed ? (
            <button key={book_id} type="button" className={className} aria-pressed={status === "owned"}
              aria-label={description} title={statusLabels[status]} aria-disabled={disabled}
              onClick={() => { if (!disabled) interactive(book_id); }}>
              {label}
            </button>
          ) : (
            <span key={book_id} className={className} title={`${description} · ${statusLabels[status]}`}>
              <span aria-hidden="true">{label}</span>
              <span className="sp-sr-only">{description} · {statusLabels[status]}</span>
            </span>
          );
        })}
      </div>
      {canExpand && <Button className="sp-vol-control" variant="ghost" size="sm"
        aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? "ย่อช่วงเล่มที่มีแล้ว" : "แสดงทุกเล่ม"}
      </Button>}
    </>
  );
}

export function VolumeLegend() {
  return (
    <div className="sp-legend">
      {Object.entries(statusLabels).map(([key, label]) => (
        <span key={key}><i className={`sp-vol--${key}`} aria-hidden="true" />{label}</span>
      ))}
    </div>
  );
}
