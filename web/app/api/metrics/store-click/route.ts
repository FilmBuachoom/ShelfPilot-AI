import { getBook } from "@/lib/data/hydrate";
import { httpUrl } from "@/lib/data/http-url";
import { updateJsonAtomic } from "@/lib/data/store";
import { isLocalDemoWrite, recordSupabaseStoreClick, usesSupabaseDemo } from "@/lib/data/supabase-demo";

export async function POST(request: Request) {
  const supabase = usesSupabaseDemo();
  if (supabase && !isLocalDemoWrite(request)) {
    return Response.json({ error: "Supabase demo writes require a local request" }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("book_id" in body) || typeof body.book_id !== "string") {
    return Response.json({ error: "Expected book_id" }, { status: 400 });
  }

  const book = await getBook(body.book_id);
  if (!book || !httpUrl(book.store_url)) {
    return Response.json({ error: "Unknown book_id or missing store link" }, { status: 400 });
  }
  if (supabase) {
    if (!(await recordSupabaseStoreClick(book.book_id))) {
      return Response.json({ error: "Unknown book_id or missing store link" }, { status: 400 });
    }
    return new Response(null, { status: 204 });
  }
  if (process.env.VERCEL === "1") {
    return Response.json({ error: "Store metrics require persistent storage" }, { status: 503 });
  }

  const event = { book_id: book.book_id, clicked_at: new Date().toISOString() };
  await updateJsonAtomic("store_clicks.json", ({ events }) => ({ events: [...events, event] }));
  return new Response(null, { status: 204 });
}
