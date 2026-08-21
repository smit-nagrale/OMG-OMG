// functions/utils/session.js
// Shared helpers for creating and verifying real, expiring, per-login
// session tokens stored in KV (SESSIONS binding) — replaces the old
// static password-hash cookie.

export async function createSession(env, ip) {
  const token = crypto.randomUUID() + crypto.randomUUID(); // long random token
  const ttlSeconds = 60 * 60 * 24; // 24 hours — keep in sync with cookie Max-Age below

  await env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now(), ip }),
    { expirationTtl: ttlSeconds }
  );

  return { token, ttlSeconds };
}

export async function verifySession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([a-f0-9-]+)/);
  const token = match ? match[1] : null;

  if (!token) return false;

  const record = await env.SESSIONS.get(`session:${token}`);
  return record !== null; // null means missing or expired (KV handles TTL)
}

export async function destroySession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([a-f0-9-]+)/);
  const token = match ? match[1] : null;
  if (token) {
    await env.SESSIONS.delete(`session:${token}`);
  }
}
