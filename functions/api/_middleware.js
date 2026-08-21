import { verifySession } from "../utils/session.js";

export async function onRequest(context) {
  const { request, env, next } = context;

  const url = new URL(request.url);

  // Login must stay open — it's how a session gets created in the first
  // place. Everything else under /api/ requires a valid session.
  if (url.pathname === "/api/login") {
    return next();
  }

  const valid = await verifySession(request, env);
  if (valid) {
    return next();
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
