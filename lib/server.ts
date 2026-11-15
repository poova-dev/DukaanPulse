import { env } from "cloudflare:workers";
import { State, emptyState } from "./domain";
export function db() {
  if (!env.DB) throw Error("storageUnavailable");
  return env.DB;
}
export async function scopeFor(req: Request) {
  const owner = req.headers.get("oai-authenticated-user-id");
  if (owner) return { scope: "owner:" + owner, cookie: undefined };
  const match = /(?:^|; )dp_session=([a-f0-9]{64})(?:;|$)/.exec(
    req.headers.get("cookie") || "",
  );
  if (match) return { scope: "session:" + match[1], cookie: undefined };
  const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    scope: "session:" + id,
    cookie: `dp_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export async function readState(scope: string): Promise<State> {
  const row = await db()
    .prepare("SELECT payload FROM workspaces WHERE scope=?")
    .bind(scope)
    .first<{ payload: string }>();
  return row ? JSON.parse(row.payload) : emptyState();
}
export async function saveState(scope: string, s: State, previous: number) {
  const payload = JSON.stringify(s);
  if (new TextEncoder().encode(payload).length > 8 * 1024 * 1024)
    throw Error("historyLimit");
  if (previous === 0) {
    const r = await db()
      .prepare(
        "INSERT OR IGNORE INTO workspaces(scope,version,payload,updated_at) VALUES(?,?,?,?)",
      )
      .bind(scope, s.version, payload, new Date().toISOString())
      .run();
    if (r.meta.changes) return;
  }
  const r = await db()
    .prepare(
      "UPDATE workspaces SET version=?,payload=?,updated_at=? WHERE scope=? AND version=?",
    )
    .bind(s.version, payload, new Date().toISOString(), scope, previous)
    .run();
  if (!r.meta.changes) throw Error("staleVersion");
}
export function response(data: unknown, status = 200, cookie?: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (cookie) h["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers: h });
}
export function sameOrigin(req: Request) {
  return req.headers.get("sec-fetch-site") !== "cross-site";
}
export function settings() {
  const e = env as unknown as Record<string, string | undefined>;
  return {
    key: e.SARVAM_API_KEY || "",
    tts: "bulbul:v3",
    stt: "saaras:v3",
    chat: "sarvam-105b",
    daily: 12,
    global: 100,
  };
}
export async function reserveUsage(scope: string) {
  const day = new Date().toISOString().slice(0, 10),
    keys = [`${day}:${scope}`, `${day}:global`],
    limits = [settings().daily, settings().global];
  for (let i = 0; i < keys.length; i++) {
    await db()
      .prepare("INSERT OR IGNORE INTO provider_usage(key,count) VALUES(?,0)")
      .bind(keys[i])
      .run();
    const r = await db()
      .prepare(
        "UPDATE provider_usage SET count=count+1 WHERE key=? AND count<?",
      )
      .bind(keys[i], limits[i])
      .run();
    if (!r.meta.changes) throw Error("rateLimit");
  }
}
export async function digest(v: string) {
  const a = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(a), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function providerFetch(
  path: string,
  body: BodyInit,
  form = false,
) {
  const { key } = settings();
  if (!key) throw Error("notConfigured");
  return fetch("https://api.sarvam.ai" + path, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
}
