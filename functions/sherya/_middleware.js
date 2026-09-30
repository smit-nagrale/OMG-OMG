// functions/sherya/_middleware.js
// Gate for everything under /sherya/*  (pages, assets and /sherya/api/*).
// Runs AFTER the global functions/_middleware.js (which adds headers, CSRF, method checks).
// Uses its OWN password, cookie and KV key prefixes so it never mixes with Utopia's session.
//
// Needs (Cloudflare Pages dashboard):
//   Secret  : SHERYA_PASSWORD
//   KV      : SESSIONS and ATTEMPTS (already bound)

const COOKIE = "sherya_sid";          // NOT "session" — Utopia's verifySession() must never match it
const SESSION_TTL = 60 * 60 * 12;     // 12 hours
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;         // 15 minute lock after MAX_FAILS

const enc = new TextEncoder();

async function sha(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

// Constant-time password comparison (compares fixed-length hashes)
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function getToken(request) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)sherya_sid=([a-f0-9-]+)/);
  return m ? m[1] : null;
}

async function hasSession(request, env) {
  const token = getToken(request);
  if (!token) return false;
  return (await env.SESSIONS.get(`sherya:session:${token}`)) !== null;
}

function loginPage(message) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Enter</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#081310;color:#EDEAE0;font-family:Inter,system-ui,sans-serif}
  form{display:flex;flex-direction:column;gap:12px;width:min(280px,86vw)}
  input,button{padding:13px;border-radius:10px;border:1px solid #2a3a33;background:#0c1a15;color:#EDEAE0;font-size:16px}
  button{background:#C79A56;color:#081310;border:0;font-weight:600;cursor:pointer}
  p{margin:0;color:#e0776b;font-size:14px}
</style></head><body>
<form method="POST" action="/sherya/__login">
  ${message ? `<p>${message}</p>` : ""}
  <input type="password" name="p" placeholder="Password" autocomplete="current-password" autofocus required>
  <button type="submit">Enter</button>
</form></body></html>`;
  return new Response(html, {
    status: message ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function handleLogin(request, env, url) {
  // Same-origin only
  const origin = request.headers.get("Origin");
  if (!origin || origin !== url.origin) return new Response("Forbidden", { status: 403 });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const failKey = `sherya:fail:${ip}`;
  const fails = parseInt((await env.ATTEMPTS.get(failKey)) || "0", 10);
  if (fails >= MAX_FAILS) return loginPage("Too many attempts. Try again later.");

  let input = "";
  try {
    input = String((await request.formData()).get("p") || "").slice(0, 200);
  } catch {
    return loginPage("Wrong password.");
  }

  if (!(await safeEqual(input.trim(), String(env.SHERYA_PASSWORD).trim()))) {
    await env.ATTEMPTS.put(failKey, String(fails + 1), { expirationTtl: LOCK_SECONDS });
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return loginPage("typed=" + input.trim().length + " stored=" + String(env.SHERYA_PASSWORD).trim().length);
  }

  await env.ATTEMPTS.delete(failKey);
  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.SESSIONS.put(
    `sherya:session:${token}`,
    JSON.stringify({ createdAt: Date.now(), ip }),
    { expirationTtl: SESSION_TTL }
  );
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/sherya/",
      "Set-Cookie": `${COOKIE}=${token}; Path=/sherya; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

async function handleLogout(request, env, url) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const token = getToken(request);
  if (token) await env.SESSIONS.delete(`sherya:session:${token}`);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/sherya/",
      "Set-Cookie": `${COOKIE}=; Path=/sherya; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Fail closed if misconfigured
  if (!env.SHERYA_PASSWORD || !env.SESSIONS || !env.ATTEMPTS) {
    return new Response("Server misconfigured", { status: 500 });
  }

  if (path === "/sherya/__login" && request.method === "POST") {
    return handleLogin(request, env, url);
  }
  if (path === "/sherya/__logout" && request.method === "POST") {
    return handleLogout(request, env, url);
  }

  if (await hasSession(request, env)) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "no-store");
    out.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return out;
  }

  // Not logged in: pages get the login form, everything else gets a plain 401
  const wantsPage = (request.headers.get("Accept") || "").includes("text/html");
  if (request.method === "GET" && wantsPage && !path.startsWith("/sherya/api/")) {
    return loginPage();
  }
  return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
