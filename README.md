# Quiz App

This project contains a small quiz app: frontend in React (Vite) and backend in Go.

Features:
- Four quiz types: `add`, `subtract`, `multiply`, `divide`.
- Backend serves random arithmetic questions (`/question?type=...`) and checks answers (`/check`).
- Frontend requests 10 questions for a selected type, shows them one-by-one, and displays the final score.

Running
-------

1. Backend (Go)

Make sure you have Go installed (1.18+).

Open a terminal in `backend` and run:

```powershell
cd "c:\Users\User\Desktop\Quiz App\backend"; go run main.go
```

The backend will listen on `http://localhost:8080`.

2. Frontend (React + Vite)

Make sure you have Node.js (16+) and npm installed.

Open a terminal in `frontend` and run:

```powershell
cd "c:\Users\User\Desktop\Quiz App\frontend"; npm install; npm run dev
```

The dev server will run on `http://localhost:3000` by default.

Notes
-----
- The backend uses simple CORS headers to allow the frontend to call it.
- For `divide` questions the backend generates numbers so that `a` is divisible by `b` to keep answers simple.
