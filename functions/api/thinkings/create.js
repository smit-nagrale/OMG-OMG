import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const formData = await request.formData();
  const title = (formData.get("title") || "").toString().trim();
  const tk = (formData.get("tk") || "").toString().trim();
  const file = formData.get("file");

  if (!title || !/^\d{1,12}$/.test(tk)) return new Response(JSON.stringify({ ok: false, reason: "invalid" }), { status: 400 });
  if (!file || typeof file === "string" || file.type !== "application/pdf")
    return new Response(JSON.stringify({ ok: false, reason: "pdf_only" }), { status: 415 });

  if ((await env.THINKINGS.get(`thinking:${tk}`)) || (await env.THINKINGS.get(`mtb:${tk}`)))
    return new Response(JSON.stringify({ ok: false, reason: "tk_taken" }), { status: 409 });

  const accessToken = await getAccessToken(env);
  const boundary = "utopia-thinkings-" + crypto.randomUUID();
  const metadata = { name: `TK-${tk}.pdf`, parents: [env.GOOGLE_DRIVE_FOLDER_ID] };
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

  const listed = await env.THINKINGS.list({ prefix: "thinking:" });
  const order = listed.keys.length;
  const entry = { tk, title, driveFileId: driveFile.id, order, createdAt: Date.now() };
  await env.THINKINGS.put(`thinking:${tk}`, JSON.stringify(entry));

  try {
    if (env.DISCORD_WEBHOOK) await fetch(env.DISCORD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**New thinking created** — TK/${tk} "${title}"` }) });
  } catch {}

  return new Response(JSON.stringify({ ok: true, entry }), { headers: { "Content-Type": "application/json" } });
}
