# 🎯 Product Requirements Document (PRD)

## 📌 Executive Summary
**Threadly** is a fast-paced, daily social deduction puzzle game designed for the internet culture era. Players are challenged to identify the hidden connection between progressively revealed clues. Designed to be played in **30-60 seconds**, Threadly drives high engagement through daily streaks, stats tracking, and spoiler-free sharing metrics.

> [!TIP]
> Think of Threadly as Wordle meets LinkedIn Pinpoint, tailored specifically for Reddit, developers, and internet culture enthusiasts.

---

## ⚡ Core Value Proposition
- **High Virality:** Results are shared as visual, spoiler-free block cards (`🟩🟩⬜⬜⬜`).
- **Low Friction:** No login required to start playing; user progress is tracked locally by default.
- **Engaging Mechanics:** Same global puzzle every 24 hours, building a shared daily experience.

---

## 🎯 Target Audience & Personas
- **The Casual Redditor:** Looking for a quick brain break while browsing threads.
- **The Developer / Tech Enthusiast:** Enjoys logic, trivia, and tech-centric categories.
- **The Daily Gamer:** Avid player of Wordle, Connections, and crossword puzzles.

---

## 🛠️ MVP Core Features (V1)
- **Daily Puzzle Engine:** One global connection puzzle released every day at midnight UTC.
- **Progressive Clue Disclosure:** Five clues ranging from "broad" to "almost revealing" are displayed sequentially.
- **Unlimited Guessing System:** Players can guess as many times as they want, but the score is dictated by the number of clues revealed.
- **Streak & Statistics Engine:** Local storage keeps track of current streak, max streak, win rate, and clue distributions.
- **Spoiler-Free Social Share:** Generates copyable text cards representing the player's performance.

---

## 🚀 Future Features (V2 & Beyond)
- **Community-Submitted Puzzles:** A submission queue where users can design their own puzzles.
- **Archive Mode:** Retroactive play for past puzzles.
- **AI-Powered Infinite Mode:** LLM-generated connection puzzles for endless play.
- **Global Leaderboards:** Competitive ranking boards using authenticated accounts.

---

## 🛑 Out of Scope for V1
- In-game messaging or user forums.
- Live multiplayer gameplay or match lobbies.
- In-app monetization (ads, paywalls).
