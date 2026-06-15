# 🗄️ Database Specification (Neon PostgreSQL)

> [!IMPORTANT]
> This application uses **Neon PostgreSQL** as its primary database.
> Schema migrations are managed via Prisma/Drizzle ORM. Row-Level Security (RLS) is active by default.

---

## 📊 Entity Relationship Summary

### Table: `users`
Tracks user credentials, session state, and account settings.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `username` | VARCHAR(50) | UNIQUE, Nullable | Public display name |
| `created_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Timestamp of creation |
| `last_seen` | TIMESTAMP WITH TZ | Default: `NOW()` | Last active session |

---

### Table: `puzzles`
Holds the daily and archived connection puzzles.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `title` | VARCHAR(100) | Not Null | Clue theme or category |
| `answer` | VARCHAR(100) | Not Null | The correct connection phrase |
| `difficulty` | INT | Check: `difficulty BETWEEN 1 AND 5` | Difficulty rating |
| `published_date` | DATE | UNIQUE, Nullable | Date scheduled for release |
| `status` | VARCHAR(20) | Default: `'draft'` | `draft`, `scheduled`, `published`, `archived` |
| `created_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Audit timestamp |

---

### Table: `clues`
Sequenced clues associated with each puzzle.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `puzzle_id` | UUID | Foreign Key -> `puzzles.id` ON DELETE CASCADE | Parent puzzle association |
| `clue_order` | INT | Check: `clue_order BETWEEN 1 AND 5` | Display sequence order |
| `clue_text` | VARCHAR(255) | Not Null | Clue string |
| `created_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Audit timestamp |

---

### Table: `guesses`
Audit table storing player guess history.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `user_id` | UUID | Foreign Key -> `users.id` (Nullable) | Associated user |
| `guest_id` | VARCHAR(255) | Nullable | Local session guest ID for anonymous players |
| `puzzle_id` | UUID | Foreign Key -> `puzzles.id` | Target puzzle |
| `guess_text` | VARCHAR(100) | Not Null | Raw text of guess |
| `is_correct` | BOOLEAN | Default: `FALSE` | Success flag |
| `clue_number` | INT | Check: `clue_number BETWEEN 1 AND 5` | Clues unlocked at time of guess |
| `created_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Time of guess |

---

### Table: `streaks`
Calculates and caches player streaks.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `user_id` | UUID | Foreign Key -> `users.id` (Nullable), UNIQUE | Target user |
| `guest_id` | VARCHAR(255) | Nullable, UNIQUE | Local session guest ID for anonymous streaks |
| `current_streak` | INT | Default: `0` | Consecutive wins |
| `best_streak` | INT | Default: `0` | Maximum streak achieved |
| `updated_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Timestamp of last calculation |

---

### Table: `stats`
Maintains user performance statistics.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique identifier |
| `user_id` | UUID | Foreign Key -> `users.id` (Nullable), UNIQUE | Target user |
| `guest_id` | VARCHAR(255) | Nullable, UNIQUE | Local session guest ID for anonymous stats |
| `games_played` | INT | Default: `0` | Total attempts |
| `games_won` | INT | Default: `0` | Total wins |
| `average_clues` | NUMERIC(3, 2) | Default: `0.00` | Average clues used for wins |
| `updated_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Timestamp of last update |

---

### Table: `categories`
Puzzles categorization tags (e.g., tech, movies, history).
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique identifier |
| `name` | VARCHAR(100) | UNIQUE, Not Null | Public display category name |
| `slug` | VARCHAR(100) | UNIQUE, Not Null | SEO friendly slug url |
| `created_at` | TIMESTAMP WITH TZ | Default: `NOW()` | Timestamp of category creation |

---

### Table: `puzzles_categories`
Junction table mapping puzzles to their categories.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `puzzle_id` | UUID | Foreign Key -> `puzzles.id` ON DELETE CASCADE | Associated puzzle |
| `category_id` | UUID | Foreign Key -> `categories.id` ON DELETE CASCADE | Associated category |

---

### Table: `leaderboard_seasons`
Tracks active seasonal time frames for rolling scoreboards.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique identifier |
| `name` | VARCHAR(100) | Not Null | Name of the season (e.g. "Season June 2026") |
| `start_date` | TIMESTAMP | Not Null | Start of season |
| `end_date` | TIMESTAMP | Not Null | End of season |
| `created_at` | TIMESTAMP | Default: `NOW()` | Creation audit |

---

### Table: `leaderboard_entries`
User score entries mapping cumulative seasonal totals.
| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique identifier |
| `season_id` | UUID | Foreign Key -> `leaderboard_seasons.id` | Active season association |
| `user_id` | UUID | Foreign Key -> `users.id` (Nullable) | Associated user |
| `guest_id` | VARCHAR(255) | Nullable | Anonymous guest player tracker |
| `score` | INT | Not Null | Cumulative score total |
| `updated_at` | TIMESTAMP | Default: `NOW()` | Date score last updated |

