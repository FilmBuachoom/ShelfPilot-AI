import { readCatalog, readShelf } from "@/lib/data/store";
import { AI_ENABLED } from "@/lib/feature-flags";
import { getRecommendations } from "@/lib/recommend/run";

export const maxDuration = 60;

async function respond(refresh: boolean) {
  if (!AI_ENABLED) return new Response(null, { status: 404 });
  const [catalog, shelf] = await Promise.all([readCatalog(), readShelf()]);
  return Response.json(await getRecommendations(catalog, shelf, refresh), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return respond(false);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("refresh" in body) || body.refresh !== true) {
    return Response.json({ error: "Expected refresh: true" }, { status: 400 });
  }
  return respond(true);
}
