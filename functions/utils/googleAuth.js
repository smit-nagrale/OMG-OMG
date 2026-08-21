// functions/utils/googleAuth.js
// Exchanges a stored OAuth refresh token for a short-lived Drive API
// access token. Uploads will land in and count against the authorizing
// Google account's own Drive storage quota.

export async function getAccessToken(env) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to refresh access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(`No access_token in refresh response: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}
