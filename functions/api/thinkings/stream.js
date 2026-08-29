import { getAccessToken } from "../../utils/googleAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  let tk = "", kind = "normal";
  try { ({ tk = "", kind = "normal" } = await request.json()); }
  catch { return new Response("Bad request", { status: 400 }); }

  if (!/^\d{1,12}$/.test(tk)) return new Response("Invalid number", { status: 400 });

  const prefix = kind === "mtb" ? "mtb" : "thinking";
  const raw = await env.THINKINGS.get(`${prefix}:${tk}`);
  if (!raw) return new Response("Not found", { status: 404 });
  const entry = JSON.parse(raw);

  try {
    const accessToken = await getAccessToken(env);
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${entry.driveFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!driveRes.ok) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "no-store");
    return new Response(driveRes.body, { headers });
  } catch (err) {
    return new Response("Error", { status: 500 });
  }
}
