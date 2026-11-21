import common from "../../../../../schemas/common.schema.json";
import { allowsLocalIngestPost } from "@/lib/ingest/access";
import type { ReviewResolution } from "@/lib/ingest/contracts";
import { resolveReview, ReviewResolutionError } from "@/lib/ingest/resolve-review";
import type { Edition } from "@/types/generated";

export const runtime = "nodejs";

function parseResolution(value: unknown): ReviewResolution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { review_id, action, book_id, edition } = value as Record<string, unknown>;
  if (typeof review_id !== "string" || !review_id.trim() || review_id.length > 200) return;
  if (action === "skip") return { review_id, action };
  if (action === "merge" && typeof book_id === "string" && book_id.trim() && book_id.length <= 200) {
    return { review_id, action, book_id };
  }
  if (action === "create" && typeof edition === "string" && common.$defs.edition.enum.includes(edition)) {
    return { review_id, action, edition: edition as Edition };
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!allowsLocalIngestPost(request)) {
    return Response.json({ error: "การอนุมัติใช้งานได้ผ่านเซิร์ฟเวอร์ JSON ในเครื่อง" }, { status: 404 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "คำขอต้องส่งข้อมูลแบบ JSON" }, { status: 415 });
  }
  const resolution = parseResolution(await request.json().catch(() => undefined));
  if (!resolution) return Response.json({ error: "ข้อมูลการตรวจสอบไม่ถูกต้อง" }, { status: 400 });

  try {
    await resolveReview(resolution);
    return Response.json({ review_id: resolution.review_id, status: "resolved" });
  } catch (error) {
    if (error instanceof ReviewResolutionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "บันทึกผลการตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
