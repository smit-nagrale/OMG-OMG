export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.LOGS.list({ prefix: "debug:", limit: 50 });

  const entries = await Promise.all(
    list.keys.map(async (k) => ({
      key: k.name,
      value: await env.LOGS.get(k.name),
    }))
  );

  entries.sort((a, b) => b.key.localeCompare(a.key));

  return new Response(JSON.stringify({ entries }), {
    headers: { "Content-Type": "application/json" },
  });
}
