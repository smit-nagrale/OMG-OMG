import { verifySession } from "../utils/session.js";

// Endpoints reachable without a login session
const PUBLIC = ["/api/login", "/api/logout", "/api/pay", "/api/status"];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (PUBLIC.includes(url.pathname)) {
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
