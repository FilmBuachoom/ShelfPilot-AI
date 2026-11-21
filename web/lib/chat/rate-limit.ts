import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const windowSeconds = 60;
const perClientLimit = 6;
const globalLimit = 30;
const keyPrefix = "shelfpilot:{chat-rate}";

type RateLimit = { allowed: true } | { allowed: false; retryAfter: number };

// Reserve both quotas atomically across production instances. A rejected request
// uses neither quota. Redis sets each expiry on the first accepted request.
const reserve = `
local retry = 0
for i = 1, #KEYS do
  local count = tonumber(redis.call("GET", KEYS[i]) or "0")
  if count >= tonumber(ARGV[i]) then
    retry = math.max(retry, math.ceil(redis.call("PTTL", KEYS[i]) / 1000), 1)
  end
end
if retry > 0 then return retry end
for i = 1, #KEYS do
  if redis.call("INCR", KEYS[i]) == 1 then
    redis.call("EXPIRE", KEYS[i], ARGV[3])
  end
end
return 0
`;

let localWindow = { count: 0, expiresAt: 0 };

function checkLocal(now = Date.now()): RateLimit {
  if (localWindow.expiresAt <= now) {
    localWindow = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }
  if (localWindow.count >= perClientLimit) {
    return { allowed: false, retryAfter: Math.ceil((localWindow.expiresAt - now) / 1000) };
  }
  localWindow.count++;
  return { allowed: true };
}

function clientKey(request: Request, token: string) {
  // Outside Vercel, the app has no trusted platform-provided client IP.
  const address = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  const version = address ? isIP(address) : 0;
  if (!address || version === 0) return keyPrefix + ":client:shared";

  const normalized = version === 6 ? new URL("http://[" + address + "]").hostname : address;
  const digest = createHmac("sha256", token).update(normalized).digest("hex");
  return keyPrefix + ":client:" + digest;
}

export async function checkChatRateLimit(request: Request): Promise<RateLimit> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url && !token) {
    return checkLocal();
  }
  if (!url || !token) throw new Error("Chat rate limit store is not configured");

  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password
    || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
    throw new Error("Invalid chat rate limit store URL");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify([
      "EVAL", reserve, 2, clientKey(request, token), keyPrefix + ":global",
      perClientLimit, globalLimit, windowSeconds,
    ]),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error("Chat rate limit store is unavailable");

  const reply: unknown = await response.json();
  if (!reply || typeof reply !== "object" || !("result" in reply)
    || typeof reply.result !== "number" || !Number.isInteger(reply.result)
    || reply.result < 0 || reply.result > windowSeconds) {
    throw new Error("Invalid chat rate limit store response");
  }

  return reply.result === 0 ? { allowed: true } : { allowed: false, retryAfter: reply.result };
}
