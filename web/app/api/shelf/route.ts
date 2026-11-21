import { readCatalog, readShelf, updateJsonAtomic } from "@/lib/data/store";
import { isLocalDemoWrite, updateSupabaseShelf, usesSupabaseDemo } from "@/lib/data/supabase-demo";
import type { BookId, UserShelf } from "@/types/generated";

export async function GET() {
  return Response.json(await readShelf());
}

function isIdArray(value: unknown): value is BookId[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

export async function POST(request: Request) {
  const supabase = usesSupabaseDemo();
  if (supabase && !isLocalDemoWrite(request)) {
    return Response.json({ error: "Supabase demo writes require a local request" }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid shelf update" }, { status: 400 });
  }

  const { add = [], remove = [] } = body as { add?: unknown; remove?: unknown };
  if (!isIdArray(add) || !isIdArray(remove) || add.some((id) => remove.includes(id))) {
    return Response.json({ error: "Expected disjoint add and remove arrays of book IDs" }, { status: 400 });
  }

  const { books } = await readCatalog();
  const knownIds = new Set(books.map(({ book_id }) => book_id));
  if ([...add, ...remove].some((id) => !knownIds.has(id))) {
    return Response.json({ error: "Unknown book_id" }, { status: 400 });
  }
  if (supabase) return Response.json(await updateSupabaseShelf(add, remove));
  if (process.env.VERCEL === "1") {
    return Response.json({ error: "Shelf writes require persistent storage" }, { status: 503 });
  }

  const shelf = await updateJsonAtomic("user_shelf.json", (current) => applyUpdate(current, add, remove));
  return Response.json(shelf);
}

function applyUpdate(current: UserShelf, add: BookId[], remove: BookId[]): UserShelf {
  const owned = new Map(current.owned.map((entry) => [entry.book_id, entry]));
  const now = new Date().toISOString();
  let changed = false;
  for (const id of remove) {
    if (owned.delete(id)) changed = true;
  }
  for (const id of add) {
    if (!owned.has(id)) {
      owned.set(id, { book_id: id, added_at: now });
      changed = true;
    }
  }

  return changed ? { owned: [...owned.values()], updated_at: now } : current;
}
