# 🤖 AI Puzzle Generation Pipeline

```
[ Gemini/OpenAI API ]
         │ (Generates answers & 5 sequential clues)
         ▼
[ Difficulty Assessment ] (Levenshtein overlap analysis)
         ▼
[ Moderation Queue ] (Saves in DB with status: 'draft')
         ▼
[ Admin Review ] (Admin approves and schedules date)
```
