import "server-only";

import { hasDemoAccess, isDemoWriteAllowed, isSupabasePreview, usesSupabaseDemo } from "@/lib/data/supabase-demo-access";

const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export function isIngestAvailable(headers: Pick<Headers, "get">): boolean {
  if (isSupabasePreview()) {
    const password = process.env.SHELFPILOT_TEAM_PASSWORD;
    return Boolean(password && hasDemoAccess(headers.get("authorization"), password));
  }
  return process.env.NODE_ENV === "development"
    && !process.env.VERCEL
    && loopbackHost.test(headers.get("host") ?? "");
}

export function allowsIngestPost(request: Request): boolean {
  if (!isIngestAvailable(request.headers)) return false;
  if (isSupabasePreview()) return isDemoWriteAllowed(request);

  const origin = request.headers.get("origin");
  if (origin === null) return !usesSupabaseDemo();

  // Next can normalize request.url to localhost while the browser uses 127.0.0.1.
  const { protocol } = new URL(request.url);
  const host = request.headers.get("host");
  return origin === `${protocol}//${host?.toLowerCase()}`;
}
