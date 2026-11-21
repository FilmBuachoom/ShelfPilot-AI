import { afterEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { runPipeline } from "@/lib/ingest/pipeline";
import { LlmUnavailableError } from "@/lib/llm/client";
import { input } from "./fixtures";
vi.mock("@/lib/ingest/pipeline", () => ({ runPipeline: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const request = (body: unknown) => new Request("http://localhost/api/ingest", { method: "POST", body: JSON.stringify(body) });

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
  expect((await POST(new Request("http://localhost/api/ingest", { method: "POST", body: "{" }))).status).toBe(400);
});

test("valid input passes through the pipeline", async () => {
  vi.mocked(runPipeline).mockResolvedValue({ status: "not_imported", message: "ok", source: { ...input, source_id: "src_test", publisher: "", imported_at: "2026-01-01T00:00:00Z" }, extraction: { items: [] }, decisions: [] });
  const response = await POST(request(input));
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
