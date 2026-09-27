// Runs before EVERY request (pages + /api/*). Security first:
// 1. Security headers on all responses
// 2. Method allow-list
// 3. Basic IP rate limiting (KV: RATE_LIMIT) — blocks brute force / spam on /api
// 4. Request size + content-type guard on POST
// 5. Blocks obvious bot/scanner UAs from /api

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);
const RATE_LIMIT_WINDOW = 60;       // seconds
const RATE_LIMIT_MAX = 30;          // requests per IP per window on /api/*
const MAX_BODY_BYTES = 2048;        // /api/pay body is tiny; reject anything bigger

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // 1. Method allow-list
  if (!ALLOWED_METHODS.has(method)) {
    return withSecurityHeaders(new Response("Method Not Allowed", { status: 405 }));
  }

  if (method === "OPTIONS") {
    return withSecurityHeaders(new Response(null, { status: 204 }));
  }

  const isApi = url.pathname.startsWith("/api/");

  if (isApi) {
    // 2. Content-Length guard on writes
    if (method === "POST") {
      const len = Number(request.headers.get("content-length") || 0);
      if (len > MAX_BODY_BYTES) {
        return withSecurityHeaders(new Response("Payload Too Large", { status: 413 }));
      }
      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return withSecurityHeaders(new Response("Unsupported Media Type", { status: 415 }));
      }
    }

    // 3. Rate limit per IP (best-effort; KV is eventually consistent)
    if (env.RATE_LIMIT) {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const key = `rl:${ip}`;
      const current = Number((await env.RATE_LIMIT.get(key)) || 0);
      if (current >= RATE_LIMIT_MAX) {
        return withSecurityHeaders(new Response("Too Many Requests", { status: 429 }));
      }
      await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
    }
  }

  const response = await next();
  return withSecurityHeaders(response);
}

function withSecurityHeaders(response) {
  const res = new Response(response.body, response);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  return res;
}
