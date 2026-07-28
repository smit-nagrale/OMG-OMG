export async function onRequestPost(context) {
  const { request, env } = context;

  let password = "";
  try {
    const body = await request.json();
    password = body.password || "";
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  if (password !== env.SITE_PASSWORD) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
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
