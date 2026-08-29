import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyThinkingsEditSession } from "../../utils/thinkingsSession.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyThinkingsEditSession(request, env)))
    return new Response(JSON.stringify({ ok: false, reason: "edit_auth" }), { status: 401, headers: { "Content-Type": "application/json" } });

  const formData = await request.formData();
  const tk = (formData.get("tk") || "").toString().trim();
  const newTitle = formData.get("title");
  const file = formData.get("file");

  const raw = await env.THINKINGS.get(`thinking:${tk}`);
  if (!raw) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404 });
  const entry = JSON.parse(raw);

  if (newTitle) entry.title = newTitle.toString().trim();

  if (file && typeof file !== "string") {
    if (file.type !== "application/pdf") return new Response(JSON.stringify({ ok: false, reason: "pdf_only" }), { status: 415 });
    const accessToken = await getAccessToken(env);
    await fetch(`https://www.googleapis.com/drive/v3/files/${entry.driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
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
    entry.driveFileId = (await driveRes.json()).id;
  }

  await env.THINKINGS.put(`thinking:${tk}`, JSON.stringify(entry));
  return new Response(JSON.stringify({ ok: true, entry }), { headers: { "Content-Type": "application/json" } });
}
