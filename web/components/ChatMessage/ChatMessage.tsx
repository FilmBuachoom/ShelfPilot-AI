import type { ReactNode } from "react";
import type { BookId, SourceId } from "@/types/generated";
import { AssistantIcon } from "../AssistantIcon/AssistantIcon";
import { BookCard } from "../BookCard/BookCard";
import { CitationChip } from "../CitationChip/CitationChip";
import { useReplyReveal, type ReplyReveal } from "./use-reply-reveal";

export function ChatMessage({ role, text, book_ids = [], source_ids = [], reveal, children }: {
  role: "user" | "assistant";
  text: string;
  book_ids?: BookId[];
  source_ids?: SourceId[];
  reveal?: ReplyReveal;
  children?: ReactNode;
}) {
  const reply = useReplyReveal(text, reveal);
  if (role === "user") return <div className="sp-msg-user">{text}</div>;

  return (
    <article className="sp-msg-ai">
      <span className="sp-msg-ai__mark"><AssistantIcon /></span>
      <div className="sp-msg-ai__body">
        {reply.revealing ? (
          <p aria-hidden="true">{reply.text}<span className="sp-reply-caret" /></p>
        ) : <p>{reply.text}</p>}
        {!reply.revealing && source_ids.length > 0 && <div className="sp-citations">
          {source_ids.map((source_id) => <CitationChip key={source_id} source_id={source_id} />)}
        </div>}
        {!reply.revealing && book_ids.length > 0 && <div className="sp-row">
          {book_ids.map((book_id) => <BookCard key={book_id} book_id={book_id} />)}
        </div>}
        {children}
      </div>
    </article>
  );
}
