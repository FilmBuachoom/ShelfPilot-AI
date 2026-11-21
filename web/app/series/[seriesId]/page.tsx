import { notFound } from "next/navigation";
import { readCatalog } from "@/lib/data/store";
import { SeriesScreen } from "./series-screen";

export default async function SeriesPage({ params, searchParams }: {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ edition?: string | string[] }>;
}) {
  const [{ seriesId }, { edition }, { books }] = await Promise.all([params, searchParams, readCatalog()]);
  const book = books.find((entry) => entry.series_id === seriesId && (edition === undefined || entry.edition === edition));
  if (!book) notFound();
  return <SeriesScreen seriesId={book.series_id} edition={book.edition} />;
}
