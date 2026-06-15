# 🎮 Game Rules & Logic

## 🏆 Scoring Structure
Points are awarded inversely proportional to the number of clues revealed at the time of solving:

| Clues Revealed | Score Awarded | Tier |
| --- | --- | --- |
| 1 Clue | **100 Points** | Genius |
| 2 Clues | **80 Points** | Excellent |
| 3 Clues | **60 Points** | Great |
| 4 Clues | **40 Points** | Close |
| 5 Clues | **20 Points** | Just Made It |

---

## 🎯 Similarity Matcher Rules
Puzzles are checked against the player's raw string input using:
1. **Normalization:** Stripping punctuation, whitespace, and converting characters to lowercase.
2. **Plural Handling:** Automatically trimming trailing `'s'` or matches for plural structures.
3. **Levenshtein Distance:** A similarity score thresholds matches at `0.85` accuracy or higher.
   - *Example:* "Programming Languages" matches "programming language" (Valid).

---

## 🔄 Daily Reset Cycle
- The daily puzzle resets at **00:00 UTC** globally.
- Once a player solves the daily puzzle, they must wait until the next UTC reset to unlock the next challenge.
- Missing a daily puzzle resets the player's active streak to `0`.
