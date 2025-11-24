const BASE = 'http://localhost:8080'

export async function fetchQuestion(type, difficulty = 1) {
  const res = await fetch(`${BASE}/question?type=${encodeURIComponent(type)}&difficulty=${encodeURIComponent(difficulty)}`)
  if (!res.ok) throw new Error('failed to fetch question')
  return res.json()
}

export async function checkAnswer(payload) {
  const res = await fetch(`${BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('failed to check answer')
  return res.json()
}
