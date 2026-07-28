export async function onRequest(context) {
  const { request, env, next } = context;

  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session=([a-f0-9]+)/);
  const token = match ? match[1] : null;

  const expected = await hashPassword(env.SITE_PASSWORD);

  if (token === expected) {
    return next(); // valid session -> serve the real vault content
  }

  // no valid session -> bounce back to the gate
  return Response.redirect(new URL("/", request.url), 302);
}

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
