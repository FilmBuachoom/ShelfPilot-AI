import { NextResponse, type NextRequest } from "next/server";
import { hasDemoAccess, isDemoWriteAllowed, isHostedDemo, usesSupabaseDemo } from "@/lib/data/supabase-demo-access";

export function proxy(request: NextRequest) {
  if (!usesSupabaseDemo() || !isHostedDemo()) return NextResponse.next();

  const headers = { "Cache-Control": "private, no-store" };
  const password = process.env.SHELFPILOT_TEAM_PASSWORD;
  if (!password) {
    return new NextResponse("Team demo access is not configured.", { status: 503, headers });
  }
  if (!hasDemoAccess(request.headers.get("authorization"), password)) {
    return new NextResponse("Team demo sign-in required.", {
      status: 401,
      headers: { ...headers, "WWW-Authenticate": 'Basic realm="ShelfPilot Team", charset="UTF-8"' },
    });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !isDemoWriteAllowed(request)) {
    return new NextResponse("Same-origin request required.", { status: 403, headers });
  }
  return NextResponse.next({ headers });
}

export const config = { matcher: "/((?!_next/static/|_next/image$).*)" };
