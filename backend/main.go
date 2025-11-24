package main

import (
    "encoding/json"
    "log"
    "math/rand"
    "net/http"
    "strconv"
    "time"
)

type Question struct {
    A int `json:"a"`
    B int `json:"b"`
    Op string `json:"op"`
    ID string `json:"id"`
}

type CheckRequest struct {
    A int `json:"a"`
    B int `json:"b"`
    Op string `json:"op"`
    Answer float64 `json:"answer"`
}

type CheckResponse struct {
    Correct bool `json:"correct"`
    Expected float64 `json:"expected"`
}

func main() {
    rand.Seed(time.Now().UnixNano())
    mux := http.NewServeMux()
    mux.HandleFunc("/question", questionHandler)
    mux.HandleFunc("/check", checkHandler)
    handler := cors(mux)
    log.Println("Backend running on :8080")
    if err := http.ListenAndServe(":8080", handler); err != nil {
        log.Fatal(err)
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
            if v < 1 { v = 1 }
            if v > 5 { v = 5 }
            diff = v
        }
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
    if t == "divide" {
        // ensure integer division: pick quotient and divisor
        divisor := b
        if divisor == 0 { divisor = 1 }
        quotient := rand.Intn(10*diff) + 1
        a = divisor * quotient
        b = divisor
    }
    if t == "subtract" {
        // ensure non-negative by swapping if necessary
        if a < b { a, b = b, a }
    }
    q := Question{A: a, B: b, Op: t, ID: strconv.FormatInt(time.Now().UnixNano(), 10)}
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
    if abs(expected - req.Answer) < 1e-6 {
        correct = true
    }
    resp := CheckResponse{Correct: correct, Expected: expected}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}

func computeExpected(a,b int, op string) float64 {
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
    if x < 0 { return -x }
    return x
}
