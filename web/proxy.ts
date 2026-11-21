import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function hasDemoAccess(authorization: string | null, password: string) {
  const supplied = authorization?.match(/^Basic (\S+)$/i)?.[1];
  if (!supplied) return false;
  const expected = Buffer.from(`shelfpilot:${password}`).toString("base64");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function proxy(request: NextRequest) {
  const password = process.env.SHELFPILOT_TEAM_PASSWORD;
  const onVercel = process.env.VERCEL === "1";
  if (!password || (!onVercel && process.env.NODE_ENV !== "production")) return NextResponse.next();

  const headers = { "Cache-Control": "private, no-store" };
  if (!hasDemoAccess(request.headers.get("authorization"), password)) {
    return new NextResponse("Team demo sign-in required.", {
      status: 401,
      headers: { ...headers, "WWW-Authenticate": 'Basic realm="ShelfPilot Team", charset="UTF-8"' },
    });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const host = request.headers.get("host") ?? request.nextUrl.host;
    const protocol = onVercel ? "https:" : request.nextUrl.protocol;
    if (request.headers.get("origin") !== `${protocol}//${host.toLowerCase()}`) {
      return new NextResponse("Same-origin request required.", { status: 403, headers });
    }
  }
  return NextResponse.next({ headers });
}

export const config = { matcher: "/((?!_next/static/|_next/image$).*)" };
