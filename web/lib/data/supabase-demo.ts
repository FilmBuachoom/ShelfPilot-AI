import "server-only";

import { headers } from "next/headers";
import type { BookId, Catalog, ReviewQueue, UserShelf } from "@/types/generated";
import { hasDemoAccess, isHostedDemo, isSupabasePreview } from "./supabase-demo-access";

interface AuthSession {
  access_token: string;
  expires_in: number;
}

export class SupabaseIngestAccessError extends Error {
  constructor() {
    super("บัญชีทีมยังไม่มีสิทธิ์จัดการแค็ตตาล็อกใน Supabase");
  }
}

function config() {
  const url = process.env.SHELFPILOT_SUPABASE_URL;
  const key = process.env.SHELFPILOT_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.SHELFPILOT_SUPABASE_DEMO_EMAIL;
  const password = process.env.SHELFPILOT_SUPABASE_DEMO_PASSWORD;
  if (!url || !key || !email || !password) {
    throw new Error("Supabase demo connection settings are incomplete.");
  }
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("The Supabase demo URL must use HTTPS.");
  }
  return { endpoint, key, email, password };
}

let session: { token: string; expiresAt: number } | undefined;
let signIn: Promise<string> | undefined;

async function accessToken(settings: ReturnType<typeof config>) {
  if (session && session.expiresAt > Date.now()) return session.token;
  if (!signIn) {
    signIn = (async () => {
      const response = await fetch(new URL("/auth/v1/token?grant_type=password", settings.endpoint), {
        method: "POST",
        headers: { apikey: settings.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: settings.email, password: settings.password }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Supabase demo sign-in failed (${response.status}).`);
      const { access_token, expires_in } = await response.json() as AuthSession;
      if (!access_token || !Number.isFinite(expires_in)) throw new Error("Invalid Supabase demo session.");
      session = { token: access_token, expiresAt: Date.now() + Math.max(0, expires_in - 30) * 1000 };
      return access_token;
    })().finally(() => { signIn = undefined; });
  }
  return signIn;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}, scope: "demo" | "admin" = "demo"): Promise<T> {
  if (isHostedDemo()) {
    if (scope === "admin" && !isSupabasePreview()) {
      throw new Error("Hosted Supabase admin access requires Vercel Preview.");
    }
    const authorization = (await headers()).get("authorization");
    const password = process.env.SHELFPILOT_TEAM_PASSWORD;
    if (!password || !hasDemoAccess(authorization, password)) {
      throw new Error("Team demo sign-in required.");
    }
  }
  const settings = config();
  const endpoint = new URL(`/rest/v1/rpc/shelfpilot_${scope}_${name}`, settings.endpoint);
  const body = JSON.stringify(args);
  const send = (token: string) => fetch(endpoint, {
    method: "POST",
    headers: { apikey: settings.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  let token = await accessToken(settings);
  let response = await send(token);
  if (response.status === 401) {
    // A late 401 for the previous token must leave a concurrent sign-in's session usable.
    if (session?.token === token) session = undefined;
    void response.body?.cancel().catch(() => undefined);
    token = await accessToken(settings);
    response = await send(token);
  }
  if (!response.ok) {
    if (response.status === 401 && session?.token === token) session = undefined;
    if (scope === "admin" && response.status === 403) throw new SupabaseIngestAccessError();
    throw new Error(`Supabase demo ${name} failed (${response.status}).`);
  }
  const result: T | null = await response.json();
  if (result === null) throw new Error(`Supabase demo ${name} returned no record.`);
  return result;
}

export const readSupabaseCatalog = () => rpc<Catalog>("catalog");
export const readSupabaseShelf = () => rpc<UserShelf>("shelf");
export const readSupabaseReviewQueue = () => rpc<ReviewQueue>("review_queue");

export function updateSupabaseShelf(add: BookId[], remove: BookId[]) {
  return rpc<UserShelf>("update_shelf", { add_ids: add, remove_ids: remove });
}

export function recordSupabaseStoreClick(bookId: BookId) {
  return rpc<boolean>("store_click", { clicked_book_id: bookId });
}

export function readSupabaseIngest() {
  return rpc<{ revision: string; catalog: Catalog; queue: ReviewQueue }>("snapshot", {}, "admin");
}

export function writeSupabaseIngest(revision: string, changes: {
  books: Catalog["books"];
  sources: Catalog["sources"];
  reviews: ReviewQueue["items"];
}) {
  return rpc<boolean>("commit", { expected_revision: revision, ...changes }, "admin");
}
