import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { book, catalog, shelf } from "./shelf-fixture";

const { requestHeaders } = vi.hoisted(() => ({ requestHeaders: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

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
  requestHeaders.mockReset();
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

test("protects hosted pages and API routes with team sign-in and same-origin writes", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SHELFPILOT_TEAM_PASSWORD", undefined);
  const { proxy } = await import("@/proxy");
  const site = "https://demo.example.test";
  expect(proxy(new NextRequest(site)).status).toBe(503);

  vi.stubEnv("SHELFPILOT_TEAM_PASSWORD", "test-team-password");
  const authorization = "Basic " + Buffer.from("shelfpilot:test-team-password").toString("base64");
  const api = `${site}/api/shelf`;
  expect(proxy(new NextRequest(api)).headers.get("WWW-Authenticate")).toContain("Basic ");
  expect(proxy(new NextRequest(api, { headers: { authorization: "Basic incorrect" } })).status).toBe(401);
  expect(proxy(new NextRequest(api, {
    method: "POST", headers: { authorization, origin: "https://other.example.test" },
  })).status).toBe(403);
  expect(proxy(new NextRequest(api, {
    method: "POST", headers: { authorization, origin: site },
  })).headers.get("x-middleware-next")).toBe("1");
});

test("authorizes a hosted shelf write before calling the Supabase RPC", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SHELFPILOT_TEAM_PASSWORD", "test-team-password");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  requestHeaders.mockResolvedValue(new Headers());
  const { GET, POST } = await import("@/app/api/shelf/route");
  await expect(GET()).rejects.toThrow("Team demo sign-in required");
  expect(fetchMock).not.toHaveBeenCalled();

  const authorization = "Basic " + Buffer.from("shelfpilot:test-team-password").toString("base64");
  const site = "https://demo.example.test";
  const updated = shelf();
  const request = new Request("http://localhost/api/shelf", {
    method: "POST",
    headers: { authorization, origin: site, host: new URL(site).host },
    body: JSON.stringify({ add: ["fixture-1"] }),
  });
  requestHeaders.mockResolvedValue(request.headers);
  fetchMock
    .mockResolvedValueOnce(Response.json({ access_token: "fixture-token", expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json(catalog(book("fixture-1", 1))))
    .mockResolvedValueOnce(Response.json(updated));
  expect(await (await POST(request)).json()).toEqual(updated);
  expect(fetchMock.mock.calls[2][0].pathname).toBe("/rest/v1/rpc/shelfpilot_demo_update_shelf");
});
