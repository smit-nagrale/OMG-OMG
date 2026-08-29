import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const { order } = await request.json(); // array of tk strings in new order
  for (let i = 0; i < order.length; i++) {
    const raw = await env.THINKINGS.get(`thinking:${order[i]}`);
    if (raw) { const entry = JSON.parse(raw); entry.order = i; await env.THINKINGS.put(`thinking:${order[i]}`, JSON.stringify(entry)); }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
