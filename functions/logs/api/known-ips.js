export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.ATTEMPTS.get("known_ips_list", { type: "json" });
  return new Response(JSON.stringify({ ips: list || [] }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const ip = (body.ip || "").trim();
  if (!ip) return new Response(JSON.stringify({ ok: false }), { status: 400 });

  const list = (await env.ATTEMPTS.get("known_ips_list", { type: "json" })) || [];
  if (!list.includes(ip)) list.push(ip);
  await env.ATTEMPTS.put("known_ips_list", JSON.stringify(list));

  return new Response(JSON.stringify({ ok: true, ips: list }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const body = await request.json();
  const ip = (body.ip || "").trim();

  let list = (await env.ATTEMPTS.get("known_ips_list", { type: "json" })) || [];
  list = list.filter(x => x !== ip);
  await env.ATTEMPTS.put("known_ips_list", JSON.stringify(list));

  return new Response(JSON.stringify({ ok: true, ips: list }), {
    headers: { "Content-Type": "application/json" },
  });
}
