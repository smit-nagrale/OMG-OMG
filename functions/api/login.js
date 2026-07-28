export async function onRequestPost(context) {
  const { request, env } = context;

  let password = "";
  let turnstileToken = "";
  try {
    const body = await request.json();
    password = body.password || "";
    turnstileToken = body.turnstileToken || "";
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  // Verify the captcha token with Cloudflare directly — this is the real check.
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: turnstileToken,
      remoteip: request.headers.get("CF-Connecting-IP"),
    }),
  });
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    return new Response(JSON.stringify({ ok: false, reason: "captcha" }), { status: 401 });
  }

  if (password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ ok: false, reason: "password" }), { status: 401 });
  }

  const token = await hashPassword(env.SITE_PASSWORD);

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
  );
  headers.append("Content-Type", "application/json");

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
