import Image from "next/image";
import type { ReactNode } from "react";
import { httpUrl } from "@/lib/data/http-url";

export function Cover({ src, glyph, size, children }: {
  src?: string;
  glyph: string | number;
  size: "thumb" | "card" | "sheet";
  children?: ReactNode;
}) {
  const className = { thumb: "sp-series__cover", card: "sp-book__cover", sheet: "sp-item__thumb" }[size];
  const url = httpUrl(src);

  return (
    <div className={`sp-cover ${className}`}>
      <span className={size === "card" ? "sp-book__glyph" : undefined} aria-hidden="true">{glyph}</span>
      {url && (
        <Image key={url} className="sp-cover__image" src={url} alt="" fill sizes={size === "card" ? "168px" : "48px"}
          unoptimized onError={(event) => { event.currentTarget.hidden = true; }} />
      )}
      {children}
    </div>
  );
}
