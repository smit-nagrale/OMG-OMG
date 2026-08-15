export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.LOGS.list({ prefix: "log:", limit: 200 });

  const entries = await Promise.all(
    list.keys.map(async (k) => {
      const val = await env.LOGS.get(k.name, { type: "json" });
      return val;
    })
  );

  // newest first
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return new Response(JSON.stringify({ entries }), {
    headers: { "Content-Type": "application/json" },
  });
}
