import { createThinkingsEditSession } from "../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `thinkings_edit_attempts:${ip}`;
  const cf = request.cf || {};

  async function notify(text) {
    try {
      if (!env.DISCORD_WEBHOOK) return;
      await fetch(env.DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `${text}\nIP: ${ip}\nLocation: ${cf.city || "?"}, ${cf.country || "?"}` }) });
    } catch {}
  }

  const record = await env.ATTEMPTS.get(key, { type: "json" });
  const now = Date.now();
  if (record && record.count >= 5 && now - record.lastAttempt < 10 * 60 * 1000) {
    await notify("**Thinkings edit** — LOCKED OUT");
    return new Response(JSON.stringify({ ok: false, reason: "locked" }), { status: 429 });
  }

  let password = "";
  try { password = (await request.json()).password || ""; }
  catch { return new Response(JSON.stringify({ ok: false }), { status: 400 }); }

  if (password !== env.THINKINGS_EDIT_PASSWORD) {
    const newCount = record ? record.count + 1 : 1;
    await env.ATTEMPTS.put(key, JSON.stringify({ count: newCount, lastAttempt: now }), { expirationTtl: 600 });
    await notify("**Thinkings edit** — wrong edit password attempted");
    return new Response(JSON.stringify({ ok: false, reason: "password" }), { status: 401 });
  }

  await env.ATTEMPTS.delete(key);
  const { token, ttlSeconds } = await createThinkingsEditSession(env, ip);
  const headers = new Headers();
  headers.append("Set-Cookie", `tesession=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttlSeconds}`);
  headers.append("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
