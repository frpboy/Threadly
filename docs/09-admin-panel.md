# ⚙️ Admin & Moderator Specification

## 📊 Content Management Interface
- **Puzzle Editor:** Draft, schedule, or archive puzzles.
- **Order Override:** Reorder clues via drag-and-drop elements.
- **Difficulty Assessor:** View statistics of completion rates to adjust difficulty ratings.

---

## 🤖 AI Assisted Puzzle Designer
- **Draft Generator:** Query LLM to suggest themes, answers, and 5 progressive clues.
- **Check Duplicates:** Similarity algorithm warns admin if the generated answer is too similar to past puzzles.
- **Moderator Checkpoint:** AI-generated content is saved as a `draft` and must be approved by a moderator before scheduling.
