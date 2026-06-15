# 🔌 API Specification

All request and response bodies are formatted in standard JSON.

---

## 1. Fetch Daily Puzzle
Retrieves the active daily puzzle. **Note**: Returns only Clue 1 to prevent client-side answer cheating.

- **Endpoint:** `GET /api/daily`
- **Response (200 OK):**
```json
{
  "puzzle_id": "8f9b4c02-7a8e-4f01-92b1-d3c2fa5678ab",
  "title": "Popular Tech Stack Connection",
  "difficulty": 2,
  "clues": [
    { "order": 1, "text": "Python" }
  ],
  "total_clues": 5,
  "published_date": "2026-06-15"
}
```

---

## 2. Submit Guess
Evaluates a guess connection string. Decouples checks to the answer service, records guest telemetry, and posts scores.

- **Endpoint:** `POST /api/guess`
- **Request Body:**
```json
{
  "puzzle_id": "8f9b4c02-7a8e-4f01-92b1-d3c2fa5678ab",
  "guess": "programming language",
  "clues_revealed": 1,
  "guest_id": "usr_7x9b"
}
```
- **Response (200 OK):**
```json
{
  "correct": true,
  "similarity_score": 0.98,
  "clues_used": 1,
  "score_awarded": 100,
  "answer": "programming languages",
  "streak": 13,
  "stats": {
    "gamesPlayed": 49,
    "gamesWon": 46,
    "averageClues": 2.3
  },
  "message": "Correct!"
}
```

---

## 3. Fetch Secure Clues
Returns a progressive clue ONLY if the player's guess log confirms they have attempted to guess on the current clue.

- **Endpoint:** `POST /api/clue`
- **Request Body:**
```json
{
  "puzzle_id": "8f9b4c02-7a8e-4f01-92b1-d3c2fa5678ab",
  "requested_clue_order": 2,
  "guest_id": "usr_7x9b"
}
```
- **Response (200 OK):**
```json
{
  "order": 2,
  "text": "JavaScript"
}
```

---

## 4. Leaderboard Operations

### Fetch Seasonal Leaderboard
- **Endpoint:** `GET /api/leaderboard`
- **Response (200 OK):**
```json
{
  "season_name": "Season June 2026",
  "ends_at": "2026-07-15T00:00:00.000Z",
  "entries": [
    { "id": "entry-uuid", "score": 280, "username": "Guest_7x9b", "avatar": null }
  ]
}
```

### Submit Leaderboard Score
- **Endpoint:** `POST /api/leaderboard`
- **Request Body:**
```json
{
  "score": 100,
  "guest_id": "usr_7x9b"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "entry_id": "entry-uuid",
  "cumulative_score": 380
}
```

