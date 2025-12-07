import React, { useEffect, useState, useRef } from "react";
import { fetchQuestion, checkAnswer, saveScore, getScores } from "./api";

const TOTAL = 10;

const SCORE_MAP = [100, 95, 88, 80, 72, 60, 50, 35, 25, 10];

export default function App() {
  const [stage, setStage] = useState("select");
  const [operationStage, setOperationStage] = useState(false);
  const [type, setType] = useState(null);
  const [question, setQuestion] = useState(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({});
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const questionScoresRef = useRef([]);

  useEffect(() => {
    // Load or create userId
    let id = localStorage.getItem("userId");
    if (!id) {
      id = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("userId", id);
    }
    setUserId(id);

    // Load dark mode preference
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.body.classList.add("dark-mode");
    }
  }, []);

  useEffect(() => {
    if (stage === "quiz") loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index]);

  function toggleDarkMode() {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode);
    if (newDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  async function loadStatistics() {
    if (!userId) {
      alert("User ID not initialized yet");
      return;
    }
    try {
      const allScores = await getScores(userId);
      console.log("All scores:", allScores);

      const statsMap = {};
      const quizTypes = ["add", "subtract", "multiply", "divide", "mixed"];

      quizTypes.forEach((qt) => {
        const typeScores = allScores
          .filter((s) => s.quiz_type === qt)
          .slice(0, 10);
        if (typeScores.length > 0) {
          statsMap[qt] = typeScores;
        }
      });

      console.log("Stats map:", statsMap);
      setStats(statsMap);
      setShowStats(true);
    } catch (err) {
      console.error("Failed to load statistics:", err);
      alert("Failed to load statistics: " + err.message);
    }
  }

  function closeStats() {
    setShowStats(false);
  }

  function startMathematics() {
    setOperationStage(true);
  }

  function startQuizForType(t) {
    questionScoresRef.current = [];
    setType(t);
    setIndex(0);
    setCorrectCount(0);
    setCumulativeScore(0);
    setStage("quiz");
    setFeedback(null);
  }

  function computeDifficulty() {
    // difficulty 1..5 based on cumulative score progress
    if (index === 0) return 1;
    const maxPossible = index * 100;
    if (maxPossible <= 0) return 1;
    const pct = cumulativeScore / maxPossible;
    const diff = Math.min(5, Math.max(1, Math.floor(pct * 5) + 1));
    return diff;
  }

  async function loadQuestion() {
    setLoading(true);
    clearTimer();
    try {
      const diff = computeDifficulty();
      const q = await fetchQuestion(type, diff);
      setQuestion(q);
      setAnswer("");
      setTimeLeft(10);
      startTimer();
    } catch (e) {
      console.error(e);
      alert("Failed to load question");
    }
    setLoading(false);
  }

  function startTimer() {
    startRef.current = Date.now();
    clearTimer();
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          clearTimer();
          handleExpire();
          return 0;
        }
        return +(t - 0.1).toFixed(1);
      });
    }, 100);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleExpire() {
    // treat as wrong and move on
    clearTimer();
    setFeedback({ correct: false, expected: computeExpected(question) });
    setTimeout(() => {
      setFeedback(null);
      if (index + 1 >= TOTAL) setStage("result");
      else setIndex((i) => i + 1);
    }, 900);
  }

  function computeExpected(q) {
    if (!q) return 0;
    const a = q.a,
      b = q.b;
    switch (q.op) {
      case "add":
        return a + b;
      case "subtract":
        return a - b;
      case "multiply":
        return a * b;
      case "divide":
        return a / b;
      default:
        return 0;
    }
  }

  function scoreForElapsed(elapsedMs) {
    const s = Math.floor(elapsedMs / 1000);
    if (s < 0) return 0;
    if (s >= 10) return 0;
    return SCORE_MAP[s] || 0;
  }

  async function submit(e) {
    e && e.preventDefault();
    if (!question) return;
    clearTimer();
    setLoading(true);
    try {
      const elapsed = Date.now() - (startRef.current || Date.now());
      const points = scoreForElapsed(elapsed);
      const payload = {
        a: question.a,
        b: question.b,
        op: question.op,
        answer: parseFloat(answer),
      };
      const res = await checkAnswer(payload);
      if (res.correct) {
        setCorrectCount((c) => c + 1);
        setCumulativeScore((s) => s + points);
        questionScoresRef.current.push(points);
      } else {
        questionScoresRef.current.push(0);
      }
      setFeedback({
        correct: res.correct,
        expected: res.expected,
        points: res.correct ? points : 0,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to check answer");
    }
    setLoading(false);
    setTimeout(() => {
      setFeedback(null);
      if (index + 1 >= TOTAL) setStage("result");
      else setIndex((i) => i + 1);
    }, 900);
  }

  function restart() {
    // Save score if userId exists
    if (userId && type && stage === "result") {
      // Calculate actual score from recorded question scores
      const actualScore = questionScoresRef.current.reduce(
        (sum, score) => sum + score,
        0,
      );
      console.log(
        "Saving score with quiz type:",
        type,
        "Actual score:",
        actualScore,
        "Question scores:",
        questionScoresRef.current,
      );
      // Always save the selected quiz type (e.g., "mixed" stays "mixed")
      saveScore(userId, type, actualScore, correctCount, TOTAL).catch((err) => {
        console.error("Failed to save score:", err);
      });
    }

    // Reset for next quiz
    questionScoresRef.current = [];
    setStage("select");
    setOperationStage(false);
    setType(null);
    setQuestion(null);
    setIndex(0);
    setCorrectCount(0);
    setCumulativeScore(0);
    setFeedback(null);
    clearTimer();
  }

  const percentage = Math.round((correctCount / TOTAL) * 100);

  return (
    <div className="app">
      <button className="theme-toggle" onClick={toggleDarkMode}>
        {darkMode ? "☀️" : "🌙"}
      </button>
      <h1>QuizSphere</h1>

      {stage === "select" && !operationStage && (
        <div className="menu">
          <p className="subtitle">Welcome to your learning hub</p>
          <div className="menu-grid">
            <button className="big" onClick={startMathematics}>
              📊 MATHEMATICS
            </button>
          </div>
          <p className="hint">More categories coming soon...</p>
        </div>
      )}

      {operationStage && stage === "select" && (
        <div className="select">
          <p>Choose your quiz mode (10 questions each)</p>
          <div className="buttons">
            {[
              { key: "add", label: "➕ Addition", emoji: "➕" },
              { key: "subtract", label: "➖ Subtraction", emoji: "➖" },
              { key: "multiply", label: "✖️ Multiplication", emoji: "✖️" },
              { key: "divide", label: "➗ Division", emoji: "➗" },
              { key: "mixed", label: "🎲 Mixed Mode", emoji: "🎲" },
            ].map((t) => (
              <button key={t.key} onClick={() => startQuizForType(t.key)}>
                {t.label}
              </button>
            ))}
            <button
              className="secondary"
              onClick={() => setOperationStage(false)}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {stage === "quiz" && (
        <div className="quiz">
          <div className="top-row">
            <div>
              Question {index + 1} of {TOTAL}
            </div>
            <div>Score: {cumulativeScore}</div>
          </div>
          <div className="time-bar">
            <div
              className="time-fill"
              style={{ width: `${(timeLeft / 10) * 100}%` }}
            />
          </div>
          {loading && (
            <p style={{ textAlign: "center", color: "#667eea" }}>Loading...</p>
          )}
          {question && (
            <form onSubmit={submit} className="question-form">
              <div className="q">
                {question.a} {opSymbol(question.op)} {question.b} = ?
              </div>
              <input
                autoFocus
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                type="number"
                step="any"
                placeholder="Enter your answer"
                required
              />
              <div className="actions">
                <button type="submit" disabled={loading}>
                  Submit Answer
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    clearTimer();
                    handleExpire();
                  }}
                >
                  Skip
                </button>
              </div>
            </form>
          )}
          {feedback && (
            <div
              className={`feedback ${feedback.correct ? "correct" : "wrong"}`}
            >
              {feedback.correct
                ? `✓ Correct! +${feedback.points} points`
                : `✗ Wrong — Answer was ${feedback.expected}`}
            </div>
          )}
          <div className="score">
            ✓ Correct so far: {correctCount}/{TOTAL}
          </div>
        </div>
      )}

      {stage === "result" && (
        <div className="result">
          <h2>Quiz Complete! 🎉</h2>
          <p className="result-message">
            Great job! You completed all 10 questions.
          </p>
          <div className="result-score">
            <div>Your Score</div>
            <div className="result-score-value">{cumulativeScore}</div>
            <div className="result-percentage">
              You got {correctCount} out of {TOTAL} correct ({percentage}%)
            </div>
          </div>
          <button onClick={restart}>Try Another Quiz</button>
          <button className="stats-button" onClick={loadStatistics}>
            📊 View Statistics
          </button>
        </div>
      )}

      {showStats && (
        <div className="stats-modal" onClick={closeStats}>
          <div className="stats-content" onClick={(e) => e.stopPropagation()}>
            <div className="stats-header">
              📈 Your Statistics
              <button className="stats-close" onClick={closeStats}>
                ✕
              </button>
            </div>

            {Object.keys(stats).length === 0 ? (
              <div className="stats-empty">
                No statistics available yet. Complete a quiz first!
              </div>
            ) : (
              Object.entries(stats).map(
                ([quizType, scores]) =>
                  scores &&
                  scores.length > 0 && (
                    <div key={quizType} className="stats-type">
                      <div className="stats-type-title">
                        {quizType === "add" && "➕ Addition"}
                        {quizType === "subtract" && "➖ Subtraction"}
                        {quizType === "multiply" && "✖️ Multiplication"}
                        {quizType === "divide" && "➗ Division"}
                        {quizType === "mixed" && "🎲 Mixed Mode"}
                      </div>
                      <div className="stats-list">
                        {scores.map((score, idx) => (
                          <div key={idx} className="stats-item">
                            <div className="stats-item-left">
                              <div className="stats-item-score">
                                Score: {score.score}
                              </div>
                              <div className="stats-item-date">
                                {new Date(
                                  score.created_at,
                                ).toLocaleDateString()}{" "}
                                {new Date(
                                  score.created_at,
                                ).toLocaleTimeString()}
                              </div>
                            </div>
                            <div className="stats-item-right">
                              <div className="stats-item-correct">
                                {score.correct}/{score.total}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function opSymbol(op) {
  switch (op) {
    case "add":
      return "+";
    case "subtract":
      return "−";
    case "multiply":
      return "×";
    case "divide":
      return "÷";
    default:
      return op;
  }
}
