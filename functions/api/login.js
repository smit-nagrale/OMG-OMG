export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `attempts:${ip}`;

  // Cloudflare automatically attaches geo info to every request — no API needed.
  const cf = request.cf || {};
  const logEntry = {
    ip,
    city: cf.city || "unknown",
    region: cf.region || "unknown",
    country: cf.country || "unknown",
    timestamp: new Date().toISOString(),
  };

  async function writeLog(result){
    try {
      const logKey = `log:${Date.now()}:${ip}`;
      await env.LOGS.put(logKey, JSON.stringify({ ...logEntry, result }), {
        expirationTtl: 60 * 60 * 24 * 30, // keep logs for 30 days
      });
    } catch {}
  }

  // ---- Check if this IP is currently locked out ----
  const record = await env.ATTEMPTS.get(key, { type: "json" });
  const now = Date.now();

  if (record && record.count >= 5 && now - record.lastAttempt < 10 * 60 * 1000) {
    const waitMins = Math.ceil((10 * 60 * 1000 - (now - record.lastAttempt)) / 60000);
    await writeLog("locked_out");
    return new Response(
      JSON.stringify({ ok: false, reason: "locked", message: `Too many attempts. Try again in ${waitMins} min.` }),
      { status: 429 }
    );
  }

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
      remoteip: ip,
    }),
  });
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    await writeLog("failed_captcha");
    return new Response(JSON.stringify({ ok: false, reason: "captcha" }), { status: 401 });
  }

  if (password !== env.SITE_PASSWORD) {
    // wrong password -> record the failed attempt
    const newCount = record ? record.count + 1 : 1;
    await env.ATTEMPTS.put(key, JSON.stringify({ count: newCount, lastAttempt: now }), {
      expirationTtl: 600, // auto-clears after 10 minutes
    });
    await writeLog("wrong_password");
    return new Response(JSON.stringify({ ok: false, reason: "password" }), { status: 401 });
  }

  // correct password -> clear any attempt record for this IP
  await env.ATTEMPTS.delete(key);
  await writeLog("success");

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
