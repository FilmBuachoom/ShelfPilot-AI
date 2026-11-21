"use client";

import Link from "next/link";
import { useBook, useCatalog } from "@/lib/data/catalog-provider";
import { daysUntilRelease, formatReleaseDate } from "@/lib/shelf/releases";
import { formatVolumes } from "@/lib/shelf/format";
import type { ShelfVolume } from "@/lib/shelf/compute";
import type { BookId, SourceId } from "@/types/generated";
import { Badge, EditionBadge } from "../Badge/Badge";
import { CitationChip } from "../CitationChip/CitationChip";
import { Cover } from "../Cover/Cover";
import { seriesHref } from "../SeriesRow/SeriesRow";
import { StorePurchase } from "../StorePurchase";
import { VolumeStrip } from "../VolumeStrip/VolumeStrip";

export function BookCard({ book_id, reason, today, source_ids = [] }: {
  book_id: BookId;
  reason?: string;
  today?: string;
  source_ids?: SourceId[];
}) {
  const book = useBook(book_id);
  const { shelf } = useCatalog();
  if (!book) return null;

  const isUpcoming = book.sale_status !== "released";
  const status: ShelfVolume["status"] = shelf.owned.some((entry) => entry.book_id === book_id)
    ? "owned" : isUpcoming ? "upcoming" : "missing";
  const countdown = today ? daysUntilRelease(book, today) : null;
  const release = formatReleaseDate(book);
  return (
    <article className="sp-book">
      <Cover size="card" src={book.cover_url} glyph={book.volume}>
        {isUpcoming && <span className="sp-book__tag"><Badge variant="new">ใหม่</Badge></span>}
      </Cover>
      <div className="sp-book__body">
        <h3 className="sp-book__title">
          <Link href={seriesHref(book.series_id, book.edition)}>{book.title} {formatVolumes(book.volume)}</Link>
        </h3>
        <div className="sp-book__sub"><EditionBadge edition={book.edition} /> {book.publisher}</div>
        <VolumeStrip size="sm" volumes={[{ book_id, volume: book.volume, status }]} />
        {countdown !== null
          ? <span className="sp-countdown">{countdown === 0 ? "วางแผงวันนี้" : `อีก ${countdown} วันวางแผง`}</span>
          : release && <span className="sp-book__sub">{release}</span>}
        {reason && <span className="sp-book__why" title={reason}>✦ {reason}</span>}
        {source_ids.map((source_id) => <CitationChip key={source_id} source_id={source_id} />)}
        <StorePurchase book={book} size="sm" />
      </div>
    </article>
  );
}
