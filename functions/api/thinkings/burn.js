import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { tkb } = await request.json();
  if (!/^\d{1,12}$/.test(tkb || "")) return new Response(JSON.stringify({ ok: false, reason: "invalid" }), { status: 400 });

  const listed = await env.THINKINGS.list({ prefix: "mtb:" });
  let match = null, matchKey = null;
  for (const k of listed.keys) {
    const raw = await env.THINKINGS.get(k.name);
    if (raw) { const parsed = JSON.parse(raw); if (parsed.tkb === tkb) { match = parsed; matchKey = k.name; break; } }
  }
  if (!match) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404 });

  const accessToken = await getAccessToken(env);
  await fetch(`https://www.googleapis.com/drive/v3/files/${match.driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  await env.THINKINGS.delete(matchKey);

  try {
    if (env.DISCORD_WEBHOOK) await fetch(env.DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**MTB burned** 🔥 — TK/${match.tk}` }) });
  } catch {}

  return new Response(JSON.stringify({ ok: true, title: match.title }), { headers: { "Content-Type": "application/json" } });
}
