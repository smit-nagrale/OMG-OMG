// functions/sherya/api/profile.js
const KEY = "sherya:user_profile";
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function onRequest({ request, env }) {
  try {
    if (request.method === "GET") {
      const profile = JSON.parse((await env.SESSIONS.get(KEY)) || "{}");
      return json(200, { ok: true, ...profile });
    }

    if (request.method === "POST") {
      const body = await request.json();
      const profile = JSON.parse((await env.SESSIONS.get(KEY)) || "{}");

      if (typeof body.name === "string") {
        profile.name = body.name.trim().slice(0, 40);
      }
      if (typeof body.avatar === "string") {
        const a = body.avatar;
        if (a === "") {
          profile.avatar = "";
        } else if (a.length <= 300000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(a)) {
          profile.avatar = a;
        } else {
          return json(400, { ok: false, reason: "bad_avatar" });
        }
      }

      await env.SESSIONS.put(KEY, JSON.stringify(profile));
      return json(200, { ok: true });
    }

    return json(405, { ok: false });
  } catch {
    return json(400, { ok: false });
  }
}
