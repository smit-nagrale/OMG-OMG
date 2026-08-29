export async function createThinkingsSession(env, ip) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const ttlSeconds = 60 * 60 * 2;
  await env.SESSIONS.put(`thinkings_session:${token}`, JSON.stringify({ createdAt: Date.now(), ip }), { expirationTtl: ttlSeconds });
  return { token, ttlSeconds };
}
export async function verifyThinkingsSession(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/tsession=([a-f0-9-]+)/);
  if (!m) return false;
  return (await env.SESSIONS.get(`thinkings_session:${m[1]}`)) !== null;
}
export async function createThinkingsEditSession(env, ip) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const ttlSeconds = 60 * 30; // 30min, edit access is short-lived on purpose
  await env.SESSIONS.put(`thinkings_edit_session:${token}`, JSON.stringify({ createdAt: Date.now(), ip }), { expirationTtl: ttlSeconds });
  return { token, ttlSeconds };
}
export async function verifyThinkingsEditSession(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/tesession=([a-f0-9-]+)/);
  if (!m) return false;
  return (await env.SESSIONS.get(`thinkings_edit_session:${m[1]}`)) !== null;
}
