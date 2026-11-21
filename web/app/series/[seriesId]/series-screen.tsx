"use client";

import Link from "next/link";
import { useState } from "react";
import { EditionBadge } from "@/components/Badge/Badge";
import { CitationChip } from "@/components/CitationChip/CitationChip";
import { seriesHref } from "@/components/SeriesRow/SeriesRow";
import { StorePurchase } from "@/components/StorePurchase";
import { VolumeLegend, VolumeStrip } from "@/components/VolumeStrip/VolumeStrip";
import { useCatalog } from "@/lib/data/catalog-provider";
import { httpUrl } from "@/lib/data/http-url";
import { formatSeriesCount, formatVolumes } from "@/lib/shelf/format";
import type { Book, BookId, Edition } from "@/types/generated";

export function SeriesScreen({ seriesId, edition }: { seriesId: string; edition: Edition }) {
  const { books, collection: { allSeries }, updateShelf, saving, saveError } = useCatalog();
  const [selection, setSelection] = useState<BookId>();
  const series = allSeries.find((row) => row.seriesId === seriesId && row.edition === edition);
  if (!series) return null;

  const { representative, volumes, missing, upcoming } = series;
  const seriesBooks = volumes.flatMap(({ book_id }) => {
    const book = books.get(book_id);
    return book ? [book] : [];
  });
  const sourceIds = [...new Set(seriesBooks.flatMap(({ sources }) => sources))];
  const purchasable = seriesBooks.filter(({ store_url }) => httpUrl(store_url));
  const selectedBook = purchasable.find(({ book_id }) => book_id === selection)
    ?? purchasable.find(({ book_id }) => [...missing, ...upcoming].some((volume) => volume.book_id === book_id))
    ?? purchasable.at(-1);
  const otherEditions = allSeries.filter((row) => row.seriesId === seriesId && row.edition !== edition);

  function toggleVolume(id: BookId) {
    const owned = volumes.some(({ book_id, status }) => book_id === id && status === "owned");
    void updateShelf(owned ? { remove: [id] } : { add: [id] });
  }

  return (
    <div className="sp-screen">
      <Link className="sp-link" href="/">‹ คลังของฉัน</Link>
      <header className="sp-screen-head">
        <h1>{representative.title}</h1>
        <div className="sp-inline"><EditionBadge edition={edition} /><span className="sp-muted">{formatSeriesCount(series)}</span></div>
        {otherEditions.length > 0 && <div className="sp-inline sp-other-editions">
          <span className="sp-muted">ฉบับอื่น</span>
          {otherEditions.map((row) => (
            <Link key={row.edition} href={seriesHref(row.seriesId, row.edition)}><EditionBadge edition={row.edition} /></Link>
          ))}
        </div>}
      </header>
      <section className="sp-section">
        <h2>เล่มในคลัง</h2>
        <p className="sp-muted">แตะเลขเล่มเพื่อเพิ่มหรือนำออกจากคลัง</p>
        <VolumeStrip key={edition} size="lg" volumes={volumes} disabled={saving} onToggle={toggleVolume} />
        <VolumeLegend />
        {saveError && <p role="alert" className="sp-muted">{saveError}</p>}
      </section>
      {sourceIds.length > 0 && <section className="sp-section">
        <h2>ประกาศจากสำนักพิมพ์</h2>
        <div className="sp-citations">{sourceIds.map((source_id) => <CitationChip key={source_id} source_id={source_id} />)}</div>
      </section>}
      {selectedBook && <section className="sp-section">
        <h2>ร้านค้า</h2>
        <StoreOptions books={purchasable} selected={selectedBook} onSelect={setSelection} />
      </section>}
    </div>
  );
}

function StoreOptions({ books, selected, onSelect }: { books: Book[]; selected: Book; onSelect: (id: BookId) => void }) {
  return (
    <div className="sp-inline">
      {books.length > 1 && <label className="sp-field">
        <span className="sp-sr-only">เลือกเล่มที่จะซื้อ</span>
        <select value={selected.book_id} onChange={(event) => onSelect(event.target.value)}>
          {books.map(({ book_id, volume }) => <option key={book_id} value={book_id}>{formatVolumes(volume)}</option>)}
        </select>
      </label>}
      <StorePurchase key={selected.book_id} book={selected} />
    </div>
  );
}
