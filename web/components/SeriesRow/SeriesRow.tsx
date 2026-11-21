import Link from "next/link";
import type { ShelfSeries } from "@/lib/shelf/compute";
import { formatSeriesCount } from "@/lib/shelf/format";
import { Badge, EditionBadge } from "../Badge/Badge";
import { Cover } from "../Cover/Cover";
import { Icon } from "../icons";
import { VolumeStrip } from "../VolumeStrip/VolumeStrip";

export function seriesHref(seriesId: string, edition: ShelfSeries["edition"]) {
  return `/series/${encodeURIComponent(seriesId)}?edition=${encodeURIComponent(edition)}`;
}

export function SeriesRow({ series }: { series: ShelfSeries }) {
  const { seriesId, edition, representative, volumes, upcoming } = series;
  return (
    <li>
      <Link className="sp-series" href={seriesHref(seriesId, edition)}>
        <Cover src={representative.cover_url} glyph={Array.from(representative.title)[0] ?? ""} size="thumb" />
        <div className="sp-series__main">
          <div className="sp-series__top">
            <h2 className="sp-series__title">{representative.title}</h2>
            {upcoming.length > 0 && <Badge variant="new">ใหม่</Badge>}
          </div>
          <div className="sp-series__meta">
            <EditionBadge edition={edition} />
            <span className="sp-series__count">{formatSeriesCount(series)}</span>
          </div>
          <VolumeStrip volumes={volumes} />
        </div>
        <span className="sp-series__chev"><Icon name="next" size={18} /></span>
      </Link>
    </li>
  );
}
