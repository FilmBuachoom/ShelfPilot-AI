import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST as STORE_CLICK } from "@/app/api/metrics/store-click/route";
import { GET, POST } from "@/app/api/shelf/route";
import { book, catalog, shelf } from "./shelf-fixture";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "shelfpilot-routes-"));
  vi.stubEnv("SHELFPILOT_DATA_DIR", directory);
  vi.stubEnv("VERCEL", undefined);
  await Promise.all([
    writeFile(path.join(directory, "catalog.json"), JSON.stringify(catalog(
      book("fixture-1", 1, { store_url: "https://example.test/shop" }),
      book("fixture-2", 2),
    ))),
    writeFile(path.join(directory, "user_shelf.json"), JSON.stringify(shelf())),
    writeFile(path.join(directory, "store_clicks.json"), JSON.stringify({ events: [] })),
  ]);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

function request(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

test("rejects unknown IDs without applying the rest of the update", async () => {
  const response = await POST(request({ add: ["fixture-1", "unknown"], remove: [] }));
  expect(response.status).toBe(400);
  expect(await (await GET()).json()).toEqual(shelf());
});

test("round-trips add and remove through the JSON store and tolerates retrying an add", async () => {
  const added = await POST(request({ add: ["fixture-1", "fixture-1"], remove: [] }));
  expect(added.status).toBe(200);
  const saved = await (await GET()).json();
  expect(saved.owned.map(({ book_id }: { book_id: string }) => book_id)).toEqual(["fixture-1"]);
  expect(await (await POST(request({ add: ["fixture-1"], remove: [] }))).json()).toEqual(saved);

  const removed = await POST(request({ add: [], remove: ["fixture-1"] }));
  expect(removed.status).toBe(200);
  expect(await (await GET()).json()).toMatchObject({ owned: [] });
});

test("preserves both concurrent shelf edits", async () => {
  const responses = await Promise.all([
    POST(request({ add: ["fixture-1"] })),
    POST(request({ add: ["fixture-2"] })),
  ]);
  expect(responses.map(({ status }) => status)).toEqual([200, 200]);
  const result = await (await GET()).json();
  expect(result.owned).toHaveLength(2);
  expect(result.owned).toEqual(expect.arrayContaining([
    expect.objectContaining({ book_id: "fixture-1" }),
    expect.objectContaining({ book_id: "fixture-2" }),
  ]));
});

test("records valid store clicks without overwriting earlier clicks", async () => {
  expect((await STORE_CLICK(request({ book_id: "fixture-2" }))).status).toBe(400);
  const results = await Promise.all([
    STORE_CLICK(request({ book_id: "fixture-1" })),
    STORE_CLICK(request({ book_id: "fixture-1" })),
  ]);
  expect(results.map(({ status }) => status)).toEqual([204, 204]);
  const { events } = JSON.parse(await readFile(path.join(directory, "store_clicks.json"), "utf8"));
  expect(events).toEqual([
    { book_id: "fixture-1", clicked_at: expect.any(String) },
    { book_id: "fixture-1", clicked_at: expect.any(String) },
  ]);
});
