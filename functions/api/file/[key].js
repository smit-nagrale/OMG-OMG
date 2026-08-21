// functions/api/file/[key].js
// Serves a file back out of Google Drive by its file ID ("key").
import { getAccessToken } from "../../utils/googleAuth.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const key = params.key;

  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(env);
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${key}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveRes.ok) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    const contentType = driveRes.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(driveRes.body, { headers });
  } catch (err) {
    return new Response("Error fetching file", { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const key = params.key;

  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(env);
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${key}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveRes.ok && driveRes.status !== 404) {
      const errText = await driveRes.text();
      return new Response(
        JSON.stringify({ error: "Delete failed", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Delete failed", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
