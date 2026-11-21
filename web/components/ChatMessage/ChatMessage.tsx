import type { ReactNode } from "react";
import type { BookId, SourceId } from "@/types/generated";
import { BookCard } from "../BookCard/BookCard";
import { CitationChip } from "../CitationChip/CitationChip";

export function ChatMessage({ role, text, book_ids = [], source_ids = [], children }: {
  role: "user" | "assistant";
  text: string;
  book_ids?: BookId[];
  source_ids?: SourceId[];
  children?: ReactNode;
}) {
  if (role === "user") return <div className="sp-msg-user">{text}</div>;

  return (
    <article className="sp-msg-ai">
      <span className="sp-msg-ai__mark" aria-hidden="true">✦</span>
      <div className="sp-msg-ai__body">
        <p>{text}</p>
        {source_ids.length > 0 && <div className="sp-citations">
          {source_ids.map((source_id) => <CitationChip key={source_id} source_id={source_id} />)}
        </div>}
        {book_ids.length > 0 && <div className="sp-row">
          {book_ids.map((book_id) => <BookCard key={book_id} book_id={book_id} />)}
        </div>}
        {children}
      </div>
    </article>
  );
}
