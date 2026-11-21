import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { proxy } from "@/proxy";

const site = "https://demo.example.test";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("SHELFPILOT_TEAM_PASSWORD", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("allows reading the demo without a password when team sign-in is unset", () => {
  expect(proxy(new NextRequest(site)).headers.get("x-middleware-next")).toBe("1");
});

test("protects hosted pages and API routes when team sign-in is configured", () => {
  vi.stubEnv("SHELFPILOT_TEAM_PASSWORD", "test-team-password");
  const authorization = "Basic " + Buffer.from("shelfpilot:test-team-password").toString("base64");
  const api = `${site}/api/shelf`;
  expect(proxy(new NextRequest(site)).status).toBe(401);
  expect(proxy(new NextRequest(api)).headers.get("WWW-Authenticate")).toContain("Basic ");
  expect(proxy(new NextRequest(api, { headers: { authorization: "Basic incorrect" } })).status).toBe(401);
  expect(proxy(new NextRequest(api, {
    method: "POST", headers: { authorization, origin: "https://other.example.test" },
  })).status).toBe(403);
  expect(proxy(new NextRequest(api, { headers: { authorization } }))
    .headers.get("Cache-Control")).toBe("private, no-store");
  expect(proxy(new NextRequest(api, {
    method: "POST", headers: { authorization, origin: site },
  })).headers.get("x-middleware-next")).toBe("1");
});
