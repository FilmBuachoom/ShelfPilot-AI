import { BookCard } from "@/components/BookCard/BookCard";
import type { BookId, SourceId } from "@/types/generated";

export type BookShelfItem = { book_id: BookId; reason?: string; source_ids?: SourceId[] };

export function BookShelfSection({ title, items, empty, today }: {
  title: string;
  items: BookShelfItem[];
  empty: string;
  today?: string;
}) {
  return (
    <section className="sp-feed-section">
      <header className="sp-section-head"><h2>{title}</h2></header>
      {items.length > 0
        ? <div className="sp-row">{items.map((item) => <BookCard key={item.book_id} {...item} today={today} />)}</div>
        : <p className="sp-feed-empty">{empty}</p>}
    </section>
  );
}
