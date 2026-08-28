// functions/api/scores/[date].js
// Deletes a single test entry by its date key.

export async function onRequestDelete(context) {
  const { env, params } = context;
  const date = params.date;

  if (!date) {
    return new Response(JSON.stringify({ success: false, error: "Missing date" }), { status: 400 });
  }

  await env.SCORES.delete(date);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
