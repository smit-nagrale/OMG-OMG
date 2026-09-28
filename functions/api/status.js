// GET /api/status?session=xxxx
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session") || "";

  if (!/^[a-z0-9]{6,32}$/i.test(session)) {
    return json({ error: "Invalid session" }, 400);
  }

  if (env.PAY_DO) {
    const stub = env.PAY_DO.get(env.PAY_DO.idFromName(session));
    const res = await stub.fetch("https://do/status");
    return json(await res.json());
  }

  const raw = await env.SESSIONS.get(`pay:${session}`);
  if (!raw) return json({ paid: false });
  try {
    const data = JSON.parse(raw);
    return json({ paid: !!data.paid, amount: data.amount });
  } catch {
    return json({ paid: false });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
