// functions/_middleware.js
// Global security layer — runs BEFORE every page, API and per-room middleware.
// 1. Blocks odd HTTP methods
// 2. Blocks access to sensitive file paths
// 3. Requires a valid session for every /api/* call (except the PUBLIC_API list)
// 4. Blocks cross-site state-changing requests (CSRF)
// 5. Adds security headers (CSP, HSTS, no-framing, no-sniffing, noindex)

import { verifySession } from "./utils/session.js";

// ---- EDIT THESE ----------------------------------------------------------
// API paths reachable WITHOUT a session. Keep this list as short as possible.
const PUBLIC_API = ["/api/login", "/api/logout"];

// Paths that must never be served.
const BLOCKED = [/^\/\.git/i, /^\/\.env/i, /^\/functions\//i, /^\/node_modules\//i, /\.(map|bak|old|sql)$/i];
// --------------------------------------------------------------------------

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function json(status, body) {
  return withHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    true
  );
}

function withHeaders(res, noStore) {
  const out = new Response(res.body, res); // makes headers mutable
  const h = out.headers;
  h.set("Content-Security-Policy", CSP);
  h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  h.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (noStore) h.set("Cache-Control", "no-store");
  return out;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // 1. Method allowlist
  if (!ALLOWED_METHODS.includes(method)) {
    return json(405, { ok: false, reason: "method_not_allowed" });
  }

  // 2. Sensitive paths
  if (BLOCKED.some((re) => re.test(path))) {
    return json(404, { ok: false });
  }

  const isApi = path.startsWith("/api/");

  // 3. CSRF: state-changing requests must come from our own origin
  if (WRITE_METHODS.includes(method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) {
      return json(403, { ok: false, reason: "bad_origin" });
    }
  }

  // 4. API auth gate
  if (isApi) {
    const isPublic = PUBLIC_API.some((p) => path === p || path === p + "/");
    if (!isPublic && method !== "OPTIONS") {
      let valid = false;
      try {
        valid = await verifySession(request, env);
      } catch {
        valid = false; // fail closed
      }
      if (!valid) return json(401, { ok: false, reason: "unauthorized" });
    }
  }

  // 5. Continue, then harden the response
  let res;
  try {
    res = await next();
  } catch {
    return json(500, { ok: false, reason: "server_error" }); // no stack traces leaked
  }
  return withHeaders(res, isApi);
}
