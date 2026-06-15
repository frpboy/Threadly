# 🔌 API Specification

All request and response bodies are formatted in standard JSON. The default API prefix is `/api/v1`.

---

## 1. Fetch Daily Puzzle
Retrieves the active daily puzzle without exposing the correct answer.

- **Endpoint:** `GET /daily`
- **Headers:** `Authorization: Bearer <JWT_TOKEN>` (optional for guests)
- **Response (200 OK):**
```json
{
  "puzzle_id": "8f9b4c02-7a8e-4f01-92b1-d3c2fa5678ab",
  "clues": [
    { "order": 1, "text": "Python" }
  ],
  "clues_revealed": 1,
  "total_clues": 5,
  "published_date": "2026-06-15"
}
```

---

## 2. Submit Guess
Evaluates a guess string against the daily puzzle's answer using similarity matching.

- **Endpoint:** `POST /guess`
- **Request Body:**
```json
{
  "puzzle_id": "8f9b4c02-7a8e-4f01-92b1-d3c2fa5678ab",
  "guess": "programming language"
}
```
- **Response (200 OK):**
```json
{
  "correct": true,
  "similarity_score": 0.98,
  "clues_used": 1,
  "score_awarded": 100,
  "message": "Correct!"
}
```

---

## 3. Retrieve User Statistics
Fetches stats for dashboard visualization.

- **Endpoint:** `GET /stats`
- **Response (200 OK):**
```json
{
  "games_played": 48,
  "games_won": 45,
  "win_percentage": 93.75,
  "average_clues_used": 2.4,
  "current_streak": 12,
  "max_streak": 30
}
```
