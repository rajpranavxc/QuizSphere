import React, { useEffect, useState } from 'react'
import { fetchQuestion, checkAnswer } from './api'

const TOTAL = 10

export default function App() {
  const [stage, setStage] = useState('select')
  const [type, setType] = useState(null)
  const [question, setQuestion] = useState(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (stage === 'quiz') loadQuestion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index])

  function start(t) {
    setType(t)
    setIndex(0)
    setCorrectCount(0)
    setStage('quiz')
    setFeedback(null)
  }

  async function loadQuestion() {
    setLoading(true)
    try {
      const q = await fetchQuestion(type)
      setQuestion(q)
      setAnswer('')
    } catch (e) {
      console.error(e)
      alert('Failed to load question')
    }
    setLoading(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (!question) return
    setLoading(true)
    try {
      const res = await checkAnswer({ a: question.a, b: question.b, op: question.op, answer: parseFloat(answer) })
      if (res.correct) setCorrectCount(c => c + 1)
      setFeedback(res)
    } catch (err) {
      console.error(err)
      alert('Failed to check answer')
    }
    setLoading(false)
    setTimeout(() => {
      setFeedback(null)
      if (index + 1 >= TOTAL) setStage('result')
      else setIndex(i => i + 1)
    }, 750)
  }

  function restart() {
    setStage('select')
    setType(null)
    setQuestion(null)
    setIndex(0)
    setCorrectCount(0)
    setFeedback(null)
  }

  return (
    <div className="app">
      <h1>Quiz App</h1>

      {stage === 'select' && (
        <div className="select">
          <p>Select quiz type (10 questions):</p>
          <div className="buttons">
            {['add', 'subtract', 'multiply', 'divide'].map(t => (
              <button key={t} onClick={() => start(t)}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {stage === 'quiz' && (
        <div className="quiz">
          <p>Question {index + 1} / {TOTAL}</p>
          {loading && <p>Loading...</p>}
          {question && (
            <form onSubmit={submit}>
              <div className="q">{question.a} {opSymbol(question.op)} {question.b} = ?</div>
              <input value={answer} onChange={e => setAnswer(e.target.value)} type="number" step="any" required />
              <div className="actions">
                <button type="submit" disabled={loading}>Submit</button>
              </div>
            </form>
          )}
          {feedback && (
            <div className={`feedback ${feedback.correct ? 'correct' : 'wrong'}`}>
              {feedback.correct ? 'Correct' : `Wrong — Expected ${feedback.expected}`}
            </div>
          )}
          <div className="score">Correct so far: {correctCount}</div>
        </div>
      )}

      {stage === 'result' && (
        <div className="result">
          <h2>Finished</h2>
          <p>You answered {correctCount} out of {TOTAL} correctly.</p>
          <button onClick={restart}>Back to menu</button>
        </div>
      )}
    </div>
  )
}

function opSymbol(op) {
  switch (op) {
    case 'add': return '+'
    case 'subtract': return '-'
    case 'multiply': return '×'
    case 'divide': return '÷'
    default: return op
  }
}
