"use client";

import { useId, useState } from "react";
import { useSource } from "@/lib/data/catalog-provider";
import { httpUrl } from "@/lib/data/http-url";
import { formatSourceDate } from "@/lib/shelf/releases";
import type { Source, SourceId } from "@/types/generated";
import { Badge } from "../Badge/Badge";

function SourceEvidence({ source, id }: { source: Source; id?: string }) {
  const url = httpUrl(source.source_url);
  return (
    <span id={id} className="sp-source">
      <span className="sp-source__head">{source.publisher}<Badge variant="verified">มีแหล่งอ้างอิง</Badge></span>
      <span className="sp-source__meta">{formatSourceDate(source.posted_at ?? source.imported_at)}</span>
      <span className="sp-raw">{source.raw_text}</span>
      {url && <a className="sp-btn sp-btn--sm" href={url} target="_blank" rel="noreferrer">ดูประกาศต้นฉบับ</a>}
    </span>
  );
}

export function CitationEvidence({ source_id }: { source_id: SourceId }) {
  const source = useSource(source_id);
  return source ? <SourceEvidence source={source} /> : null;
}

export function CitationChip({ source_id }: { source_id: SourceId }) {
  const source = useSource(source_id);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!source) return null;

  return (
    <span className="sp-citation">
      <button type="button" className="sp-cite" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}>
        <span className="sp-cite__dot" aria-hidden="true" />
        {source.publisher} · {formatSourceDate(source.posted_at ?? source.imported_at)}
      </button>
      {open && <SourceEvidence source={source} id={id} />}
    </span>
  );
}
