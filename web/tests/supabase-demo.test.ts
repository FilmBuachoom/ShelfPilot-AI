import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { book, catalog, shelf } from "./shelf-fixture";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "supabase");
  vi.stubEnv("SHELFPILOT_SUPABASE_URL", "https://demo.example.test");
  vi.stubEnv("SHELFPILOT_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable-key");
  vi.stubEnv("SHELFPILOT_SUPABASE_DEMO_EMAIL", "demo@example.test");
  vi.stubEnv("SHELFPILOT_SUPABASE_DEMO_PASSWORD", "fixture-test-password");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("uses Supabase for catalog reads and the shelf write and subsequent read", async () => {
  const seed = catalog(book("fixture-1", 1));
  const owned = { ...shelf(), owned: [{ book_id: "fixture-1", added_at: "2026-11-21T00:00:00Z" }] };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ access_token: "fixture-token", expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json(seed))
    .mockResolvedValueOnce(Response.json(owned))
    .mockResolvedValueOnce(Response.json(owned));
  vi.stubGlobal("fetch", fetchMock);

  const { GET, POST } = await import("@/app/api/shelf/route");
  const response = await POST(new Request("http://localhost:3212/api/shelf", {
    method: "POST",
    headers: { Host: "127.0.0.1:3212", Origin: "http://127.0.0.1:3212" },
    body: JSON.stringify({ add: ["fixture-1"] }),
  }));
  expect(await response.json()).toEqual(owned);
  expect(await (await GET()).json()).toEqual(owned);
  expect(fetchMock.mock.calls.map(([url]) => (url as URL).pathname)).toEqual([
    "/auth/v1/token", "/rest/v1/rpc/shelfpilot_demo_catalog",
    "/rest/v1/rpc/shelfpilot_demo_update_shelf", "/rest/v1/rpc/shelfpilot_demo_shelf",
  ]);
  expect(fetchMock.mock.calls[2][1]).toMatchObject({
    body: JSON.stringify({ add_ids: ["fixture-1"], remove_ids: [] }),
    headers: { Authorization: "Bearer fixture-token" },
    cache: "no-store",
  });
});

test("rejects cross-origin shelf writes without contacting Supabase", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { POST } = await import("@/app/api/shelf/route");
  const response = await POST(new Request("http://127.0.0.1:3212/api/shelf", {
    method: "POST",
    headers: { Origin: "https://other.example.test" },
    body: JSON.stringify({ add: ["fixture-1"] }),
  }));
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("refuses to use the shared demo shelf in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { usesSupabaseDemo } = await import("@/lib/data/supabase-demo");
  expect(() => usesSupabaseDemo()).toThrow("local development server");
});
