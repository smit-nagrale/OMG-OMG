// functions/utils/session.js
// Sessions are random tokens stored in KV (SESSIONS binding).
// Each session also stores a keyed fingerprint of the SITE_PASSWORD that was
// valid when it was created. If SITE_PASSWORD changes, old sessions stop
// matching and are rejected immediately.

const enc = new TextEncoder();
const SESSION_TTL = 60 * 60 * 24; // 24 hours, keep in sync with cookie Max-Age in login.js

async function passwordFingerprint(env) {
  if (!env.SITE_PASSWORD) throw new Error("SITE_PASSWORD not set"); // fail closed
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.SITE_PASSWORD),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("utopia-session-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(env, ip) {
  const token = crypto.randomUUID() + crypto.randomUUID(); // long random token
  const pw = await passwordFingerprint(env);

  await env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now(), ip, pw }),
    { expirationTtl: SESSION_TTL }
  );

  return { token, ttlSeconds: SESSION_TTL };
}

export async function verifySession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([a-f0-9-]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) return false; // missing or expired

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return false;
  }

  // Reject sessions created under a previous SITE_PASSWORD
  // (this also rejects sessions from before this change, which have no `pw`)
  const current = await passwordFingerprint(env);
  return record.pw === current;
}

export async function destroySession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([a-f0-9-]+)/);
  const token = match ? match[1] : null;
  if (token) {
    await env.SESSIONS.delete(`session:${token}`);
  }
}
