// saturday-test/_middleware.js
// Gates every request under /saturday-test/ behind a valid session cookie
// (the same session created by functions/api/login.js). Anyone without a
// valid, non-expired session token is redirected to the login page instead
// of seeing the room's content or being able to hit its data.

import { verifySession } from "../functions/utils/session.js";

export async function onRequest(context) {
  const { request, env, next } = context;

  const ok = await verifySession(request, env);
  if (!ok) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  return next();
}
