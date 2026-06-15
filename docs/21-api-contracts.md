# 🔌 Secure API Contract Specification

### POST `/api/guess`
- **Request Parameters:**
  - `puzzle_id`: `String` (UUID)
  - `guess`: `String` (Raw input)
  - `clues_revealed`: `Number` (Active clue order)
- **Response Payloads:**
  - **Cheat-proof response (Incorrect):**
    ```json
    { "correct": false, "answer": null, "message": "Incorrect answer" }
    ```
  - **Final reveal response (Correct or 5th clue failed):**
    ```json
    { "correct": true, "answer": "programming languages", "score_awarded": 100 }
    ```
