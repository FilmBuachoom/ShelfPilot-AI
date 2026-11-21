"use client";

import { useState } from "react";
import { httpUrl } from "@/lib/data/http-url";
import type { Book, BookId } from "@/types/generated";
import { Button } from "./Button/Button";
import { ConfirmModal } from "./ConfirmModal/ConfirmModal";

function trackStoreClick(book_id: BookId) {
  void fetch("/api/metrics/store-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book_id }),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) throw new Error("Store click request failed");
  }).catch(() => console.warn("ShelfPilot: store click was not recorded."));
}

export function StorePurchase({ book, size = "default" }: { book: Book; size?: "default" | "sm" }) {
  const [open, setOpen] = useState(false);
  const url = httpUrl(book.store_url);
  if (!url) return null;

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>ไปหน้าร้าน</Button>
      {open && (
        <ConfirmModal book={book} onCancel={() => setOpen(false)} onConfirm={() => {
          setOpen(false);
          trackStoreClick(book.book_id);
          window.open(url, "_blank", "noopener,noreferrer");
        }} />
      )}
    </>
  );
}
