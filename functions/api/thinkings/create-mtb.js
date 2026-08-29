import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const formData = await request.formData();
  const title = (formData.get("title") || "").toString().trim();
  const tk = (formData.get("tk") || "").toString().trim();
  const tkb = (formData.get("tkb") || "").toString().trim();
  const file = formData.get("file");

  if (!title || !/^\d{1,12}$/.test(tk) || !/^\d{1,12}$/.test(tkb))
    return new Response(JSON.stringify({ ok: false, reason: "invalid" }), { status: 400 });
  if (!file || typeof file === "string" || file.type !== "application/pdf")
    return new Response(JSON.stringify({ ok: false, reason: "pdf_only" }), { status: 415 });

  if ((await env.THINKINGS.get(`thinking:${tk}`)) || (await env.THINKINGS.get(`mtb:${tk}`)))
    return new Response(JSON.stringify({ ok: false, reason: "tk_taken" }), { status: 409 });

  const existingMtb = await env.THINKINGS.list({ prefix: "mtb:" });
  for (const k of existingMtb.keys) {
    const raw = await env.THINKINGS.get(k.name);
    if (raw && JSON.parse(raw).tkb === tkb)
      return new Response(JSON.stringify({ ok: false, reason: "tkb_taken" }), { status: 409 });
  }

  const accessToken = await getAccessToken(env);
  const boundary = "utopia-thinkings-" + crypto.randomUUID();
  const metadata = { name: `TK-${tk}-mtb.pdf`, parents: [env.GOOGLE_DRIVE_FOLDER_ID] };
  const fileBuffer = await file.arrayBuffer();
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    fileBuffer, `\r\n--${boundary}--`,
  ]);
  const driveRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
  if (!driveRes.ok) return new Response(JSON.stringify({ ok: false, reason: "drive" }), { status: 502 });
  const driveFile = await driveRes.json();

  const entry = { tk, tkb, title, driveFileId: driveFile.id, createdAt: Date.now() };
  await env.THINKINGS.put(`mtb:${tk}`, JSON.stringify(entry));

  try {
    if (env.DISCORD_WEBHOOK) await fetch(env.DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**MTB created** — TK/${tk} "${title}"` }) });
  } catch {}

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
