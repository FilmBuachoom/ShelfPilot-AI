import { allowsLocalIngestPost } from "@/lib/ingest/access";
import { resolveReview, ReviewResolutionError } from "@/lib/ingest/resolve-review";
import { parseReviewResolution } from "@/lib/ingest/review-record";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!allowsLocalIngestPost(request)) {
    return Response.json({ error: "การอนุมัติใช้งานได้ผ่านเซิร์ฟเวอร์ JSON ในเครื่อง" }, { status: 404 });
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
    return Response.json({ error: "บันทึกผลการตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
