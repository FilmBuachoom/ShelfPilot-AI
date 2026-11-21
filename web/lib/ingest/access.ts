import "server-only";

const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export function isLocalIngestAvailable(headers: Pick<Headers, "get">): boolean {
  return process.env.NODE_ENV === "development"
    && !process.env.VERCEL
    && loopbackHost.test(headers.get("host") ?? "");
}

export function allowsLocalIngestPost(request: Request): boolean {
  if (!isLocalIngestAvailable(request.headers)) return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;

  // Next can normalize request.url to localhost while the browser uses 127.0.0.1.
  const { protocol } = new URL(request.url);
  const host = request.headers.get("host");
  return origin === `${protocol}//${host?.toLowerCase()}`;
}
