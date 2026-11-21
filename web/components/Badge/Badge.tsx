import type { ReactNode } from "react";
import type { Edition } from "@/types/generated";

export const editionLabels: Record<Edition, string> = {
  manga: "มังงะ",
  light_novel: "นิยาย",
  special_set: "บ็อกซ์เซ็ต",
  big_book: "บิ๊กบุ๊ก",
};

type BadgeVariant = "edition" | "new" | "missing" | "verified" | "review" | "info" | "muted";

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return <span className={`sp-badge sp-badge--${variant}`}>{children}</span>;
}

export function EditionBadge({ edition }: { edition: Edition }) {
  return <Badge variant="edition">{editionLabels[edition]}</Badge>;
}
