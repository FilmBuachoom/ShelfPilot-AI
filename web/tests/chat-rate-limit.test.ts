import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CHAT_RATE_LIMITED } from "@/lib/chat/shared";

const { readCatalog, readShelf, runChat } = vi.hoisted(() => ({
  readCatalog: vi.fn(),
  readShelf: vi.fn(),
  runChat: vi.fn(),
}));
vi.mock("@/lib/data/store", () => ({ readCatalog, readShelf }));
vi.mock("@/lib/chat/run", () => ({ runChat }));

function request(headers: Record<string, string> = {}, content = "เล่มไหนออกใหม่บ้าง") {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content }] }),
  });
}

function configureRedis() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-test-token");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("NEXT_PUBLIC_AI_ENABLED", "true");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  runChat.mockResolvedValue({ text: "พบข้อมูล", book_ids: [], source_ids: [], not_found: false, needs_clarification: false });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T12:00:00+07:00"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("allows six concurrent local requests, then blocks without reading data or calling the model", async () => {
  const { POST } = await import("@/app/api/chat/route");
  const responses = await Promise.all(Array.from({ length: 7 }, (_, index) => POST(request({
    "x-vercel-forwarded-for": "203.0.113." + (index + 1),
  }))));
  const rejected = responses.find(({ status }) => status === 429);
  expect(responses.filter(({ status }) => status === 200)).toHaveLength(6);
  expect(rejected?.headers.get("Retry-After")).toBe("60");
  expect(rejected?.headers.get("Cache-Control")).toBe("no-store");
  expect(await rejected?.json()).toEqual(CHAT_RATE_LIMITED);
  expect(readCatalog).toHaveBeenCalledTimes(6);
  expect(readShelf).toHaveBeenCalledTimes(6);
  expect(runChat).toHaveBeenCalledTimes(6);

  vi.setSystemTime(new Date("2026-11-21T12:01:00+07:00"));
  expect((await POST(request())).status).toBe(200);
  expect(runChat).toHaveBeenCalledTimes(7);
});

test("checks request validity before using the shared counter", async () => {
  configureRedis();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { POST } = await import("@/app/api/chat/route");
  expect((await POST(request({}, "   "))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});

test("uses atomic per-client and global limits with the trusted Vercel header", async () => {
  configureRedis();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ result: 0 }))
    .mockResolvedValueOnce(Response.json({ result: 34 }))
    .mockResolvedValueOnce(Response.json({ result: 0 }))
    .mockResolvedValueOnce(Response.json({ result: 0 }));
  vi.stubGlobal("fetch", fetchMock);
  const { POST } = await import("@/app/api/chat/route");

  expect((await POST(request({ "x-vercel-forwarded-for": "203.0.113.1" }))).status).toBe(200);
  const denied = await POST(request({
    "x-vercel-forwarded-for": "203.0.113.1", "x-forwarded-for": "203.0.113.9",
  }));
  expect(denied.status).toBe(429);
  expect(denied.headers.get("Retry-After")).toBe("34");
  expect(await denied.json()).toEqual(CHAT_RATE_LIMITED);
  expect((await POST(request({ "x-vercel-forwarded-for": "203.0.113.2" }))).status).toBe(200);
  expect((await POST(request({ "x-forwarded-for": "203.0.113.9" }))).status).toBe(200);
  expect(runChat).toHaveBeenCalledTimes(3);

  const commands = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(commands[0]).toEqual([
    "EVAL", expect.stringContaining('redis.call("INCR"'), 2,
    expect.stringMatching(/:client:[a-f0-9]{64}$/), "shelfpilot:{chat-rate}:global", 6, 30, 60,
  ]);
  expect(commands[0][3]).toBe(commands[1][3]);
  expect(commands[0][3]).not.toBe(commands[2][3]);
  expect(commands[3][3]).toBe("shelfpilot:{chat-rate}:client:shared");
  expect(JSON.stringify(commands)).not.toMatch(/203\.0\.113\.|เล่มไหนออกใหม่บ้าง/);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
});

test("uses the local limit on Vercel when Redis is not configured", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  const { POST } = await import("@/app/api/chat/route");
  const responses = await Promise.all(Array.from({ length: 7 }, () => POST(request())));
  expect(responses.filter(({ status }) => status === 200)).toHaveLength(6);
  expect(responses.filter(({ status }) => status === 429)).toHaveLength(1);
  expect(runChat).toHaveBeenCalledTimes(6);
});

test("rejects partially configured Redis without calling the model", async () => {
  configureRedis();
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  const { POST } = await import("@/app/api/chat/route");
  expect((await POST(request())).status).toBe(503);
  expect(readCatalog).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});

test.each(["outage", "bad response"])("fails closed when Redis has a %s", async (mode) => {
  configureRedis();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    mode === "outage" ? new Response(null, { status: 502 }) : Response.json({ result: "0" }),
  ));
  const { POST } = await import("@/app/api/chat/route");
  expect((await POST(request())).status).toBe(503);
  expect(readCatalog).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});
