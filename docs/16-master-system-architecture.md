# 🏗️ Master System Architecture

## 🖼️ Game Loop Sequence Diagram

```mermaid
sequenceDiagram
    actor Player
    participant Frontend as Next.js Web App
    participant API as Edge API Handler
    participant DB as Neon PostgreSQL

    Player->>Frontend: Load /daily
    Frontend->>API: GET /api/v1/daily
    API->>DB: Fetch active puzzle & 1st clue
    DB-->>API: Active puzzle metadata
    API-->>Frontend: Send puzzle ID & 1st clue
    Player->>Frontend: Enter guess & click submit
    Frontend->>API: POST /api/v1/guess (guess_text)
    API->>API: Run similarity matching (Levenshtein)
    alt Guess is Correct
        API->>DB: Record guess & update stats
        API-->>Frontend: Correct: true, award points
    else Guess is Incorrect
        API->>DB: Record guess
        API-->>Frontend: Correct: false, unlock next clue
    end
```

---

## 🚀 Performance Caching Layer
- **Vercel Edge Caching:** Caches the daily puzzle object for 5 minutes.
- **Leaderboards:** Cached database view updating every 60 seconds.
- **Static Assets:** 30 days immutable caching header settings.
