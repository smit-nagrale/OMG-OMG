// functions/sherya/api/profile.js
  export async function onRequest({ request, env }) {
    const KEY = "sherya:user_profile";

    if (request.method === "GET") {
      const data = await env.SESSIONS.get(KEY);
      const profile = data ? JSON.parse(data) : {};
      return new Response(JSON.stringify({ ok: true, ...profile }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST") {
      try {
        const updates = await request.json();
        const current = await env.SESSIONS.get(KEY);
        const profile = current ? JSON.parse(current) : {};
        const updatedProfile = { ...profile, ...updates };
        await env.SESSIONS.put(KEY, JSON.stringify(updatedProfile));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { status: 400 });
      }
    }
    return new Response(null, { status: 405 });
  }
