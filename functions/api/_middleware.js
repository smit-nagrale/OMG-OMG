import { verifySession } from "../utils/session.js";

export async function onRequest(context) {
  const { request, env, next } = context;

  const valid = await verifySession(request, env);
  if (valid) {
    return next();
  }

  return Response.redirect(new URL("/", request.url), 302);
}
