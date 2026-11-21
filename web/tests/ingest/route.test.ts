import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { runPipeline } from "@/lib/ingest/pipeline";
import { LlmUnavailableError } from "@/lib/llm/client";
import { input } from "./fixtures";
vi.mock("@/lib/ingest/pipeline", () => ({ runPipeline: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

function rawRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/ingest", {
    method: "POST", body,
    headers: { Host: "127.0.0.1:3000", "Content-Type": "application/json", ...headers },
  });
}

const request = (body: unknown, headers?: Record<string, string>) => rawRequest(JSON.stringify(body), headers);

test("deployed and production requests never reach the extractor", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await POST(request(input))).status).toBe(404);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "1");
  expect((await POST(request(input))).status).toBe(404);
  expect(runPipeline).not.toHaveBeenCalled();
});

test.each<Record<string, string>>([
  { Host: "public.example.test" },
  { Origin: "https://other.example.test" },
  { Origin: "http://127.0.0.1:4000" },
  { Origin: "null" },
])("rejects non-local host or cross-origin submissions: %j", async (headers) => {
  expect((await POST(request(input, headers))).status).toBe(404);
  expect(runPipeline).not.toHaveBeenCalled();
});

test("Supabase demo mode rejects imports before calling the pipeline", async () => {
  vi.stubEnv("SHELFPILOT_DATA_BACKEND", "supabase");
  expect((await POST(request(input))).status).toBe(404);
  expect(runPipeline).not.toHaveBeenCalled();
});

test("requires a JSON content type before reading the body", async () => {
  expect((await POST(request(input, { "Content-Type": "text/plain" }))).status).toBe(415);
  expect(runPipeline).not.toHaveBeenCalled();
});

test.each([{}, { ...input, raw_text: "  " }, { ...input, source_url: "file:///etc/passwd" }, { ...input, publisher_hint: 1 }, { ...input, source_url: "https://user:password@example.test" }, { ...input, raw_text: "a".repeat(30001) }])(
  "invalid input is rejected before LLM work", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(runPipeline).not.toHaveBeenCalled();
  },
);

test("oversized request stream is bounded before parsing", async () => {
  expect((await POST(request({ ...input, extra: "a".repeat(128001) }))).status).toBe(413);
  expect(runPipeline).not.toHaveBeenCalled();
});

test("malformed JSON is rejected", async () => {
  expect((await POST(rawRequest("{"))).status).toBe(400);
});

test("valid input passes through the pipeline", async () => {
  vi.mocked(runPipeline).mockResolvedValue({ status: "not_imported", message: "ok", source: { ...input, source_id: "src_test", publisher: "", imported_at: "2026-01-01T00:00:00Z" }, extraction: { items: [] }, decisions: [] });
  const response = await POST(request(input, { Origin: "http://127.0.0.1:3000" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "not_imported" });
  expect(runPipeline).toHaveBeenCalledWith(input);
});

test.each([new LlmUnavailableError(new Error("private provider detail")), new Error("private path")])(
  "errors do not expose provider or filesystem details", async (error) => {
    vi.mocked(runPipeline).mockRejectedValue(error);
    const response = await POST(request(input));
    expect(response.status).toBe(error instanceof LlmUnavailableError ? 503 : 500);
    expect(await response.text()).not.toContain("private");
  },
);
