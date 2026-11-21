import { allowsIngestPost } from "@/lib/ingest/access";
import { SupabaseIngestAccessError } from "@/lib/data/supabase-demo";
import { resolveReview, ReviewResolutionError } from "@/lib/ingest/resolve-review";
import { parseReviewResolution } from "@/lib/ingest/review-record";
import { IngestConflictError } from "@/lib/ingest/storage";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!allowsIngestPost(request)) {
    return Response.json({ error: "การอนุมัติใช้งานได้บน localhost หรือ Vercel ที่ตั้งค่าสิทธิ์แอดมิน Supabase ให้บัญชีทีมแล้ว" }, { status: 404 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "คำขอต้องส่งข้อมูลแบบ JSON" }, { status: 415 });
  }
  const resolution = parseReviewResolution(await request.json().catch(() => undefined));
  if (!resolution) return Response.json({ error: "ข้อมูลการตรวจสอบไม่ถูกต้อง" }, { status: 400 });

  try {
    await resolveReview(resolution);
    return Response.json({ review_id: resolution.review_id, status: "resolved" });
  } catch (error) {
    if (error instanceof ReviewResolutionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof IngestConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof SupabaseIngestAccessError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "บันทึกผลการตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
