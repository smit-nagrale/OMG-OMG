// functions/api/upload.js
// Handles file uploads (images/audio) into Google Drive for Wishes and Dreams.
// Expects a multipart/form-data POST with a "file" field.
import { getAccessToken } from "../utils/googleAuth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "File too large (max 20MB)" }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const allowedPrefixes = ["image/", "audio/"];
    const isAllowed = allowedPrefixes.some((p) => file.type.startsWith(p));
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Only image or audio files are allowed" }),
        { status: 415, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(env);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const metadata = {
      name: `${Date.now()}-${safeName}`,
      parents: [env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const boundary = "utopia-upload-" + crypto.randomUUID();
    const fileBuffer = await file.arrayBuffer();
    const bodyParts = [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata) + "\r\n",
      `--${boundary}\r\n`,
      `Content-Type: ${file.type}\r\n\r\n`,
    ];
    const multipartBody = new Blob([
      bodyParts[0] + bodyParts[1] + bodyParts[2] + bodyParts[3] + bodyParts[4],
      fileBuffer,
      `\r\n--${boundary}--`,
    ]);

    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return new Response(
        JSON.stringify({ error: "Drive upload failed", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const driveFile = await driveRes.json();
    return new Response(
      JSON.stringify({
        success: true,
        key: driveFile.id,
        url: `/api/file/${driveFile.id}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upload failed", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
