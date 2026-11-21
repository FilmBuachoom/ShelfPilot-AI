import type { ShelfStats } from "@/lib/shelf/compute";
import { Icon } from "../icons";
import { Button } from "../Button/Button";

export function ShelfHeader({ stats, query, onQueryChange, onAdd, onStatClick }: {
  stats: ShelfStats;
  query: string;
  onQueryChange: (query: string) => void;
  onAdd: () => void;
  onStatClick: (filter: "missing" | "upcoming") => void;
}) {
  const statsList = [
    { key: "series", label: "เรื่อง" },
    { key: "volumes", label: "เล่ม" },
    { key: "missing", label: "ขาด" },
    { key: "upcoming", label: "ใกล้ออก" },
  ] as const;
  return (
    <header className="sp-shelf-head">
      <div className="sp-shelf-head__top">
        <h1 className="sp-shelf-head__title">คลังของฉัน</h1>
        <Button onClick={onAdd}>+ เพิ่มเรื่อง</Button>
      </div>
      <div className="sp-stats">
        {statsList.map(({ key, label }) => {
          const content = <><span className="sp-stat__num">{stats[key]}</span><span className="sp-stat__label">{label}</span></>;
          return key === "missing" || key === "upcoming" ? (
            <button className={`sp-stat sp-stat--${key}`} key={key} type="button" onClick={() => onStatClick(key)}>
              {content}
            </button>
          ) : <div className="sp-stat" key={key}>{content}</div>;
        })}
      </div>
      <label className="sp-search">
        <Icon name="search" size={18} />
        <span className="sp-sr-only">ค้นหาในคลัง</span>
        <input type="search" placeholder="ค้นหาชื่อเรื่องหรือชื่อย่อ" value={query}
          onChange={(event) => onQueryChange(event.target.value)} />
      </label>
    </header>
  );
}
