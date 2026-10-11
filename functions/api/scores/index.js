// functions/api/scores/index.js
// Saturday Test Tracker — list + create entries.
// Storage: KV namespace `SCORES`, one key per test date -> JSON entry.
// You enter MARKS per subject (no negatives). Each question is worth 4 marks,
// so questions = marks / 4. Everything is validated server-side so stored
// scores can't be tampered with by editing the page.
// (Older entries that have correct/wrong/score still load fine.)

import { publicEntry } from "../../utils/scoreEntry.js";

const SUBJECTS = ["physics", "chemistry", "biology"];

function toMarks(v) {
  const n = Number(v);
  // whole number, not negative, multiple of 4 (one question = 4 marks)
  return Number.isInteger(n) && n >= 0 && n % 4 === 0 ? n : null;
}

function fail(status, error) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  // Drive file IDs never leave the server (see utils/scoreEntry.js)
  const clean = entries
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(publicEntry);

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
    return fail(400, "Invalid JSON");
  }
  if (!body || typeof body !== "object") return fail(400, "Invalid JSON");

  const { date, testId, maxMarks } = body;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail(400, "Invalid date");
  }
  if (typeof testId !== "string" || !/^\d{3}$/.test(testId)) {
    return fail(400, "Test ID must be exactly 3 digits");
  }

  const max = Number(maxMarks);
  if (!Number.isInteger(max) || max <= 0 || max > 100000) {
    return fail(400, "Max Marks must be a positive whole number");
  }

  const marks = SUBJECTS.map((k) => toMarks(body[k] && body[k].marks));
  if (marks.some((m) => m === null)) {
    return fail(400, "Marks must be whole numbers in multiples of 4");
  }

  const totalScore = marks[0] + marks[1] + marks[2];
  if (totalScore > max) {
    return fail(400, "Total marks cannot be more than Max Marks");
  }

  // `correct` = questions scored (marks / 4), `score` = marks
  const entry = {
    date, // "YYYY-MM-DD", also the KV key
    testId, // "009"
    maxMarks: max,
    physics: { correct: marks[0] / 4, score: marks[0] },
    chemistry: { correct: marks[1] / 4, score: marks[1] },
    biology: { correct: marks[2] / 4, score: marks[2] },
    totalScore,
    totalPercent: (totalScore / max) * 100,
  };

  // re-saving a date keeps the PDFs already attached to it
  const prevRaw = await env.SCORES.get(date);
  if (prevRaw) {
    try {
      const prev = JSON.parse(prevRaw);
      if (prev.questionFile) entry.questionFile = prev.questionFile;
      if (prev.resultFile) entry.resultFile = prev.resultFile;
      if (prev.pdfV) entry.pdfV = prev.pdfV;
    } catch {}
  }

  await env.SCORES.put(date, JSON.stringify(entry));

  return new Response(JSON.stringify({ success: true, entry: publicEntry(entry) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
