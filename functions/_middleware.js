export async function onRequest(context) {
  const { request, env, next } = context;

  const authHeader = request.headers.get("Authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [, password] = decoded.split(":"); // username can be anything, e.g. "smit"

      if (password === env.SITE_PASSWORD) {
        return next(); // correct password -> let them through to the actual site
      }
    }
  }

  // No auth, or wrong password -> ask again
  return new Response("Locked.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Only for HIM"',
    },
  });
}
