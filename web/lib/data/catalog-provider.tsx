"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createCatalogSearch } from "@/lib/search/catalog-search";
import { computeShelf } from "@/lib/shelf/compute";
import type { BookId, Catalog, SourceId, UserShelf } from "@/types/generated";
import { logUnknownId } from "./unknown-id";

type ShelfUpdate = { add?: BookId[]; remove?: BookId[] };

function useCatalogValue(catalog: Catalog, initialShelf: UserShelf) {
  const [shelf, setShelf] = useState(initialShelf);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const inFlight = useRef(false);
  const books = useMemo(() => new Map(catalog.books.map((book) => [book.book_id, book])), [catalog.books]);
  const sources = useMemo(() => new Map(catalog.sources.map((source) => [source.source_id, source])), [catalog.sources]);
  const searchCatalog = useMemo(() => createCatalogSearch(catalog.books), [catalog.books]);
  const collection = useMemo(() => computeShelf(catalog.books, shelf), [catalog.books, shelf]);

  async function updateShelf(update: ShelfUpdate) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (response.status === 503) {
        setSaveError("การบันทึกคลังยังไม่พร้อมบนเซิร์ฟเวอร์นี้");
        return false;
      }
      if (!response.ok) throw new Error("Shelf update failed");
      setShelf(await response.json() as UserShelf);
      return true;
    } catch {
      setSaveError("บันทึกคลังไม่สำเร็จ ลองอีกครั้ง");
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return { books, sources, shelf, collection, searchCatalog, updateShelf, saving, saveError };
}

const CatalogContext = createContext<ReturnType<typeof useCatalogValue> | null>(null);

export function CatalogProvider({ catalog, shelf, children }: { catalog: Catalog; shelf: UserShelf; children: ReactNode }) {
  const value = useCatalogValue(catalog, shelf);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog requires CatalogProvider");
  return value;
}

function useMissingId(field: "book_id" | "source_id", id: string, missing: boolean) {
  useEffect(() => {
    if (missing) logUnknownId(field, id);
  }, [field, id, missing]);
}

export function useBook(id: BookId) {
  const book = useCatalog().books.get(id);
  useMissingId("book_id", id, !book);
  return book;
}

export function useSource(id: SourceId) {
  const source = useCatalog().sources.get(id);
  useMissingId("source_id", id, !source);
  return source;
}
