const BASE = "http://localhost:8080";

export async function fetchQuestion(type, difficulty = 1) {
  const res = await fetch(
    `${BASE}/question?type=${encodeURIComponent(type)}&difficulty=${encodeURIComponent(difficulty)}`,
  );
  if (!res.ok) throw new Error("failed to fetch question");
  return res.json();
}

export async function checkAnswer(payload) {
  const res = await fetch(`${BASE}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed to check answer");
  return res.json();
}

export async function saveScore(userId, quizType, score, correct, total) {
  const res = await fetch(`${BASE}/save-score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      quiz_type: quizType,
      score: score,
      correct: correct,
      total: total,
    }),
  });
  if (!res.ok) throw new Error("failed to save score");
  return res.json();
}

export async function getScores(userId, quizType = null) {
  let url = `${BASE}/get-scores?user_id=${encodeURIComponent(userId)}`;
  if (quizType) {
    url += `&quiz_type=${encodeURIComponent(quizType)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("failed to fetch scores");
  return res.json();
}
