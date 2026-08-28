// functions/api/scores/index.js
// Saturday Test Tracker — list + create entries.
// Storage: KV namespace `SCORES`, one key per test date -> JSON entry.
// Marking scheme (+4 correct, -1 wrong) is applied server-side so stored
// scores can't be tampered with by editing the page.

function calcSubject(correct, wrong) {
  correct = Number(correct) || 0;
  wrong = Number(wrong) || 0;
  return correct * 4 - wrong * 1;
}

export async function onRequestGet(context) {
  const { env } = context;

  const list = await env.SCORES.list();
  const entries = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.SCORES.get(k.name);
      return raw ? JSON.parse(raw) : null;
    })
  );

  const clean = entries.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

  return new Response(JSON.stringify({ success: true, entries: clean }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { status: 400 });
  }

  const { date, maxMarks, physics, chemistry, biology } = body;

  if (!date || !maxMarks || !physics || !chemistry || !biology) {
    return new Response(JSON.stringify({ success: false, error: "Missing fields" }), { status: 400 });
  }

  const max = Number(maxMarks);
  if (!max || max <= 0) {
    return new Response(JSON.stringify({ success: false, error: "Max Marks must be a positive number" }), { status: 400 });
  }

  const physicsScore = calcSubject(physics.correct, physics.wrong);
  const chemistryScore = calcSubject(chemistry.correct, chemistry.wrong);
  const biologyScore = calcSubject(biology.correct, biology.wrong);
  const totalScore = physicsScore + chemistryScore + biologyScore;

  const entry = {
    date, // "YYYY-MM-DD", also the KV key and unique id
    maxMarks: max,
    physics: { correct: Number(physics.correct) || 0, wrong: Number(physics.wrong) || 0, score: physicsScore },
    chemistry: { correct: Number(chemistry.correct) || 0, wrong: Number(chemistry.wrong) || 0, score: chemistryScore },
    biology: { correct: Number(biology.correct) || 0, wrong: Number(biology.wrong) || 0, score: biologyScore },
    totalScore,
    totalPercent: (totalScore / max) * 100,
  };

  await env.SCORES.put(date, JSON.stringify(entry));

  return new Response(JSON.stringify({ success: true, entry }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
