// POST /api/pay  { session, amount }
// Stores { paid:true, amount } in KV under the session key, 10 min TTL.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { session, amount } = body || {};

  if (typeof session !== "string" || !/^[a-z0-9]{6,32}$/i.test(session)) {
    return json({ error: "Invalid session" }, 400);
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > 1e12) {
    return json({ error: "Invalid amount" }, 400);
  }

  await env.SESSIONS.put(
    `pay:${session}`,
    JSON.stringify({ paid: true, amount: amt, at: Date.now() }),
    { expirationTtl: 600 }
  );

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
