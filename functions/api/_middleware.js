import { verifySession } from "../utils/session.js";

export async function onRequest(context) {
  const { request, env, next } = context;

  const valid = await verifySession(request, env);
  if (valid) {
    return next();
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
