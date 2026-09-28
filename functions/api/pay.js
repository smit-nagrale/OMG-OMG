// POST /api/pay  { session, amount }
// Stores { paid:true, amount } in a Durable Object (instant). Falls back to KV if PAY_DO isn't bound yet.
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

  if (env.PAY_DO) {
    const stub = env.PAY_DO.get(env.PAY_DO.idFromName(session));
    await stub.fetch("https://do/pay", {
      method: "POST",
      body: JSON.stringify({ amount: amt }),
    });
  } else {
    await env.SESSIONS.put(
      `pay:${session}`,
      JSON.stringify({ paid: true, amount: amt, at: Date.now() }),
      { expirationTtl: 600 }
    );
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
