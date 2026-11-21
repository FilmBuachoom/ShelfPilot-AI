import { LlmUnavailableError } from "@/lib/llm/client";
import { allowsLocalIngestPost } from "@/lib/ingest/access";
import { runPipeline } from "@/lib/ingest/pipeline";
import type { IngestInput } from "@/lib/ingest/contracts";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BODY_BYTES = 128_000;

function validInput(value: unknown): value is IngestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.raw_text !== "string" || !input.raw_text.trim() || input.raw_text.length > 30_000) return false;
  if (typeof input.source_url !== "string" || input.source_url.length > 2048) return false;
  if (input.publisher_hint !== undefined && (typeof input.publisher_hint !== "string" || input.publisher_hint.length > 200)) return false;
  try {
    const url = new URL(input.source_url);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export async function POST(request: Request): Promise<Response> {
  if (!allowsLocalIngestPost(request)) {
    return Response.json({ error: "Import / Extract ใช้งานได้ผ่านเซิร์ฟเวอร์ทดลองในเครื่อง" }, { status: 404 });
  }
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json({ error: "คำขอต้องส่งข้อมูลแบบ JSON" }, { status: 415 });
  }

  // This route never fetches the URL: it is provenance supplied by the admin.
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "กรุณากรอกข้อความและ URL ต้นทาง" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return Response.json({ error: "ข้อความยาวเกินกำหนด" }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
  }
  if (!validInput(input)) {
    return Response.json({ error: "กรุณากรอกข้อความไม่เกิน 30,000 ตัวอักษร และ URL แบบ http หรือ https" }, { status: 400 });
  }
  try {
    return Response.json(await runPipeline(input));
  } catch (error) {
    return Response.json({
      error: error instanceof LlmUnavailableError
        ? "ยังสกัดข้อมูลไม่ได้ตอนนี้ กรุณาลองอีกครั้ง ข้อความของคุณยังอยู่"
        : "นำเข้าข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง",
    }, { status: error instanceof LlmUnavailableError ? 503 : 500 });
  }
}
