import { getBook } from "@/lib/data/hydrate";
import { httpUrl } from "@/lib/data/http-url";
import { updateJsonAtomic } from "@/lib/data/store";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("book_id" in body) || typeof body.book_id !== "string") {
    return Response.json({ error: "Expected book_id" }, { status: 400 });
  }

  const book = await getBook(body.book_id);
  if (!book || !httpUrl(book.store_url)) {
    return Response.json({ error: "Unknown book_id or missing store link" }, { status: 400 });
  }
  if (process.env.VERCEL === "1") {
    return Response.json({ error: "Store metrics require persistent storage" }, { status: 503 });
  }

  const event = { book_id: book.book_id, clicked_at: new Date().toISOString() };
  await updateJsonAtomic("store_clicks.json", ({ events }) => ({ events: [...events, event] }));
  return new Response(null, { status: 204 });
}
