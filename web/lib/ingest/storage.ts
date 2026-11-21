import "server-only";

import { readCatalog, readReviewQueue, updateJsonAtomic } from "@/lib/data/store";
import { usesSupabaseDemo } from "@/lib/data/supabase-demo-access";
import { readSupabaseIngest, writeSupabaseIngest } from "@/lib/data/supabase-demo";
import type { Catalog, ReviewQueue } from "@/types/generated";

export type UpdateReviewQueue = (update: (queue: ReviewQueue) => ReviewQueue) => Promise<unknown>;

type IngestStorage = {
  readCatalog: () => Promise<Catalog>;
  readReviewQueue: () => Promise<ReviewQueue>;
  writeCatalog: (catalog: Catalog) => Promise<unknown>;
  updateReviewQueue: UpdateReviewQueue;
};

export class IngestConflictError extends Error {
  constructor() {
    super("แค็ตตาล็อกหรือคิวตรวจสอบมีการเปลี่ยนแปลง กรุณาลองอีกครั้ง");
  }
}

export async function readIngestSnapshot() {
  if (usesSupabaseDemo()) return readSupabaseIngest();
  const [catalog, queue] = await Promise.all([readCatalog(), readReviewQueue()]);
  return { catalog, queue };
}

async function writeSupabase<T>(write: (storage: IngestStorage) => Promise<T>) {
  const previous = await readSupabaseIngest();
  let { catalog, queue } = previous;
  const result = await write({
    readCatalog: async () => catalog,
    readReviewQueue: async () => queue,
    writeCatalog: async (next) => { catalog = next; },
    updateReviewQueue: async (update) => { queue = update(queue); },
  });
  const originalBooks = new Set(previous.catalog.books);
  const originalSources = new Set(previous.catalog.sources);
  const originalReviews = new Set(previous.queue.items);
  const books = catalog.books.filter((book) => !originalBooks.has(book));
  const sources = catalog.sources.filter((source) => !originalSources.has(source));
  const reviews = queue.items.filter((item) => !originalReviews.has(item));
  if ((books.length || sources.length || reviews.length)
    && !(await writeSupabaseIngest(previous.revision, { books, sources, reviews }))) {
    throw new IngestConflictError();
  }
  return result;
}

let pendingLocalWrite: Promise<unknown> = Promise.resolve();

export function withIngestWrite<T>(write: (storage: IngestStorage) => Promise<T>) {
  if (usesSupabaseDemo()) return writeSupabase(write);
  const next = pendingLocalWrite.catch(() => undefined).then(() => write({
    readCatalog,
    readReviewQueue,
    writeCatalog: (catalog) => updateJsonAtomic("catalog.json", () => catalog),
    updateReviewQueue: (update) => updateJsonAtomic("review_queue.json", update),
  }));
  pendingLocalWrite = next;
  return next;
}
