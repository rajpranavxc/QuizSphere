package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"
)

var (
	scoresFile = "scores.json"
	scores     = make(map[string][]ScoreRecord) // userID -> scores
)

type Question struct {
	A  int    `json:"a"`
	B  int    `json:"b"`
	Op string `json:"op"`
	ID string `json:"id"`
}

type CheckRequest struct {
	A      int     `json:"a"`
	B      int     `json:"b"`
	Op     string  `json:"op"`
	Answer float64 `json:"answer"`
}

type CheckResponse struct {
	Correct  bool    `json:"correct"`
	Expected float64 `json:"expected"`
}

type ScoreRecord struct {
	ID        int       `json:"id"`
	UserID    string    `json:"user_id"`
	QuizType  string    `json:"quiz_type"`
	Score     int       `json:"score"`
	Correct   int       `json:"correct"`
	Total     int       `json:"total"`
	CreatedAt time.Time `json:"created_at"`
}

type ScoresResponse struct {
	Type   string        `json:"type"`
	Scores []ScoreRecord `json:"scores"`
}

func main() {
	rand.Seed(time.Now().UnixNano())

	// Load existing scores from file
	loadScores()

	mux := http.NewServeMux()
	mux.HandleFunc("/question", questionHandler)
	mux.HandleFunc("/check", checkHandler)
	mux.HandleFunc("/save-score", saveScoreHandler)
	mux.HandleFunc("/get-scores", getScoresHandler)
	handler := cors(mux)
	log.Println("Backend running on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatal(err)
	}
}

// loadScores loads scores from the JSON file
func loadScores() {
	if _, err := os.Stat(scoresFile); os.IsNotExist(err) {
		scores = make(map[string][]ScoreRecord)
		return
	}

	data, err := ioutil.ReadFile(scoresFile)
	if err != nil {
		log.Printf("Error reading scores file: %v", err)
		scores = make(map[string][]ScoreRecord)
		return
	}

	if err := json.Unmarshal(data, &scores); err != nil {
		log.Printf("Error unmarshaling scores: %v", err)
		scores = make(map[string][]ScoreRecord)
	}
}

// saveScoresFile writes scores to the JSON file
func saveScoresFile() {
	data, err := json.MarshalIndent(scores, "", "  ")
	if err != nil {
		log.Printf("Error marshaling scores: %v", err)
		return
	}

	if err := ioutil.WriteFile(scoresFile, data, 0644); err != nil {
		log.Printf("Error writing scores file: %v", err)
	}
}

func cors(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func questionHandler(w http.ResponseWriter, r *http.Request) {
	t := r.URL.Query().Get("type")
	if t == "" {
		http.Error(w, "missing type", http.StatusBadRequest)
		return
	}
	diffStr := r.URL.Query().Get("difficulty")
	diff := 1
	if diffStr != "" {
		if v, err := strconv.Atoi(diffStr); err == nil {
			if v < 1 {
				v = 1
			}
			if v > 5 {
				v = 5
			}
			diff = v
		}
	}

	// if mixed, pick a random operation type
	opType := t
	if t == "mixed" {
		ops := []string{"add", "subtract", "multiply", "divide"}
		opType = ops[rand.Intn(len(ops))]
		log.Printf("Mixed mode selected: %s", opType)
	}

	// scale ranges by difficulty (1..5)
	// difficulty increases magnitude of numbers
	var a, b int
	switch diff {
	case 1:
		a = rand.Intn(10) + 1
		b = rand.Intn(10) + 1
	case 2:
		a = rand.Intn(20) + 1
		b = rand.Intn(20) + 1
	case 3:
		a = rand.Intn(40) + 5
		b = rand.Intn(30) + 3
	case 4:
		a = rand.Intn(80) + 10
		b = rand.Intn(50) + 5
	default:
		a = rand.Intn(150) + 20
		b = rand.Intn(100) + 10
	}
	if opType == "divide" {
		// ensure integer division: pick quotient and divisor
		divisor := b
		if divisor == 0 {
			divisor = 1
		}
		quotient := rand.Intn(10*diff) + 1
		a = divisor * quotient
		b = divisor
	}
	if opType == "subtract" {
		// ensure non-negative by swapping if necessary
		if a < b {
			a, b = b, a
		}
	}
	// Always return the actual operation type, never "mixed"
	q := Question{A: a, B: b, Op: opType, ID: strconv.FormatInt(time.Now().UnixNano(), 10)}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func checkHandler(w http.ResponseWriter, r *http.Request) {
	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	expected := computeExpected(req.A, req.B, req.Op)
	correct := false
	if abs(expected-req.Answer) < 1e-6 {
		correct = true
	}
	resp := CheckResponse{Correct: correct, Expected: expected}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func computeExpected(a, b int, op string) float64 {
	switch op {
	case "add":
		return float64(a + b)
	case "subtract":
		return float64(a - b)
	case "multiply":
		return float64(a * b)
	case "divide":
		return float64(a) / float64(b)
	default:
		return 0
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// saveScoreHandler saves a quiz score to memory and file
func saveScoreHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID   string `json:"user_id"`
		QuizType string `json:"quiz_type"`
		Score    int    `json:"score"`
		Correct  int    `json:"correct"`
		Total    int    `json:"total"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Create score record
	sr := ScoreRecord{
		ID:        len(scores[req.UserID]) + 1,
		UserID:    req.UserID,
		QuizType:  req.QuizType,
		Score:     req.Score,
		Correct:   req.Correct,
		Total:     req.Total,
		CreatedAt: time.Now(),
	}

	// Add to scores map
	scores[req.UserID] = append(scores[req.UserID], sr)

	// Save to file
	saveScoresFile()

	log.Printf("Score saved - UserID: %s, Type: %s, Score: %d, Correct: %d/%d",
		req.UserID, req.QuizType, req.Score, req.Correct, req.Total)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// getScoresHandler retrieves scores for a user
func getScoresHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	userScores, exists := scores[userID]
	if !exists {
		userScores = []ScoreRecord{}
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("Returning %d scores for user %s", len(userScores), userID)
	json.NewEncoder(w).Encode(userScores)
}
