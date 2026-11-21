import { afterEach, beforeEach, expect, test, vi } from "vitest";

const request = {
  model: "test-model",
  messages: [{ role: "user" as const, content: "Return a status." }],
  schema: {
    name: "status",
    schema: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
  },
};

function unavailableResponse() {
  return Response.json(
    { error: { message: "Service unavailable" } },
    { status: 503, headers: { "retry-after-ms": "1" } },
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("retries a temporary failure and parses the structured reply", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(unavailableResponse())
    .mockResolvedValueOnce(Response.json({
      choices: [{
        finish_reason: "stop",
        message: { role: "assistant", content: '{"ok":true}', refusal: null },
      }],
    }));
  vi.stubGlobal("fetch", fetchMock);
  const { callStructured } = await import("@/lib/llm/client");

  await expect(callStructured<{ ok: boolean }>(request)).resolves.toMatchObject({
    data: { ok: true },
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [, options] = fetchMock.mock.calls[0];
  expect(JSON.parse(options.body)).toMatchObject({
    response_format: {
      type: "json_schema",
      json_schema: { ...request.schema, strict: true },
    },
  });
});

test("returns the fallback error after one retry", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(unavailableResponse())
    .mockResolvedValueOnce(unavailableResponse());
  vi.stubGlobal("fetch", fetchMock);
  const { callStructured, LlmUnavailableError } = await import("@/lib/llm/client");

  await expect(callStructured(request)).rejects.toBeInstanceOf(LlmUnavailableError);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
