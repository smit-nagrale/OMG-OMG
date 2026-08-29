export async function onRequestGet(context) {
  const { request, env } = context;
  const q = new URL(request.url).searchParams.get("q")?.toLowerCase() || "";
  const listed = await env.THINKINGS.list({ prefix: "thinking:" });
  const items = [];
  for (const k of listed.keys) {
    const raw = await env.THINKINGS.get(k.name);
    if (raw) items.push(JSON.parse(raw));
  }
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const filtered = q ? items.filter(i => i.tk.includes(q) || i.title.toLowerCase().includes(q)) : items;
  return new Response(JSON.stringify({ ok: true, items: filtered }), { headers: { "Content-Type": "application/json" } });
}
