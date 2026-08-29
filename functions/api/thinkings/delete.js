import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { tk } = await request.json();
  const raw = await env.THINKINGS.get(`thinking:${tk}`);
  if (!raw) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404 });
  const entry = JSON.parse(raw);

  const accessToken = await getAccessToken(env);
  await fetch(`https://www.googleapis.com/drive/v3/files/${entry.driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  await env.THINKINGS.delete(`thinking:${tk}`);

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
