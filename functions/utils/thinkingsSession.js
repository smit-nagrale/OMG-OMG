export async function createThinkingsSession(env, ip) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const ttlSeconds = 60 * 60 * 2; // 2hr, shorter than main session on purpose
  await env.SESSIONS.put(
    `thinkings_session:${token}`,
    JSON.stringify({ createdAt: Date.now(), ip }),
    { expirationTtl: ttlSeconds }
  );
  return { token, ttlSeconds };
}

export async function verifyThinkingsSession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/tsession=([a-f0-9-]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;
  const record = await env.SESSIONS.get(`thinkings_session:${token}`);
  return record !== null;
}
