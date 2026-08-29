import { verifyThinkingsSession } from "../../utils/thinkingsSession.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const valid = await verifyThinkingsSession(request, env);
  if (!valid) return new Response(JSON.stringify({ ok: false, reason: "auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return next();
}
