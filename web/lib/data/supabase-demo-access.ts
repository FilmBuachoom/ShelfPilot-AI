import { createHash, timingSafeEqual } from "node:crypto";

export function usesSupabaseDemo() {
  return process.env.SHELFPILOT_DATA_BACKEND === "supabase";
}

export function isHostedDemo() {
  return process.env.NODE_ENV !== "development" || process.env.VERCEL === "1";
}

export function isSupabasePreview() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview" && usesSupabaseDemo();
}

export function hasDemoAccess(authorization: string | null, password: string) {
  const supplied = authorization?.match(/^Basic (\S+)$/i)?.[1];
  if (!supplied) return false;
  const expected = Buffer.from(`shelfpilot:${password}`).toString("base64");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function isDemoWriteAllowed(request: Request) {
  const target = new URL(request.url);
  // Next can normalize the request URL to localhost while preserving Host.
  const host = request.headers.get("host") ?? target.host;
  const origin = request.headers.get("origin");
  if (isHostedDemo()) {
    const protocol = process.env.VERCEL === "1" ? "https:" : target.protocol;
    return origin === `${protocol}//${host.toLowerCase()}`;
  }
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(host)
    && (!origin || origin === `${target.protocol}//${host}`);
}
