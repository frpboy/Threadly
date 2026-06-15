# Threadly Development Log & Rules

This log file tracks all development changes to the Threadly project. It is append-only, structured chronologically, and must adhere to the rules below.

---

## Logging Rules
1. **Append-Only**: Always append new entries to the end of the file. Never delete or edit historical entries.
2. **Sequential Entry Numbers**: Each entry must start with a heading containing a unique sequential number, e.g., `## Entry #1: [Brief Title]`.
3. **Metadata Requirements**: Every entry must explicitly state:
   - **Timestamp**: Date and time (e.g. `June 15, 2026, 4:55 PM`)
   - **Why**: The rationale or problem being addressed.
   - **When**: Trigger or context of change.
   - **How**: Technical implementation approach.
   - **What**: Concrete list of what was achieved.
4. **File Diffs & Rationale**: Explicitly list all files modified/created with clickable paths and the specific reason for changes.

---

## Entry #1: Generation of Execution Layer and Database Schema Updates
- **Timestamp**: June 15, 2026, 4:55 PM
- **Why**: Address missing documentation to prevent AI agent technical debt and support secure gameplay logs for anonymous players (cheating prevention).
- **When**: Triggered by user request to establish the execution layer docs and architectural fixes.
- **How**: Executed Python generation scripts to create missing PRD/roadmap docs and updated the Prisma schema model for guest tracking.
- **What**:
  - Created 14 design and checklist documents (docs 17-30).
  - Created 9 autonomous agent templates (agents/*.md).
  - Expanded `17-task-backlog.md` to cover exactly 150 tasks (TASK-001 to TASK-150).
  - Updated Prisma `Guess` schema to support anonymous `guestId` tracking and performance indexes.
  - Decoupled code logic into separate services (`answerService.ts`, `scoringService.ts`, `puzzleService.ts`).
- **Files Changed**:
  - [schema.prisma](file:///e:/K4NN4N/Threadly/apps/web/prisma/schema.prisma): Added `guestId` and indexes on `Guess` table.
  - [17-task-backlog.md](file:///e:/K4NN4N/Threadly/docs/17-task-backlog.md) to [30-coding-standards.md](file:///e:/K4NN4N/Threadly/docs/30-coding-standards.md): Generated docs 17 to 30.
  - [product-manager.md](file:///e:/K4NN4N/Threadly/agents/product-manager.md) to [deployment.md](file:///e:/K4NN4N/Threadly/agents/deployment.md): Generated agent configurations.
  - [answerService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/answerService.ts): Created guess validation service.
  - [scoringService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/scoringService.ts): Created score calculation service.
  - [puzzleService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/puzzleService.ts): Created database interface service.

## Entry #2: Refactoring Clue Delivery and Implementing Secure Progressive Reveals
- **Timestamp**: June 15, 2026, 4:58 PM
- **Why**: Prevent cheating where a user could view all progressive clues instantly in the browser's developer tools.
- **When**: Triggered by Problem 1 in architecture assessment (clues leak) and TASK-002/TASK-003 in backlog.
- **How**:
  - Modified the daily route to return only Clue 1 on GET.
  - Implemented `/api/clue` (POST) to return requested progressive clues only if user/guest has attempted guesses for preceding clues.
  - Integrated local storage guest IDs for anonymous players.
  - Decoupled API guess logic to utilize `answerService`, `scoringService` and `puzzleService`.
- **Files Changed**:
  - [route.ts](file:///e:/K4NN4N/Threadly/apps/web/app/api/daily/route.ts): Modified daily route to return only Clue 1.
  - [route.ts](file:///e:/K4NN4N/Threadly/apps/web/app/api/guess/route.ts): Refactored guess handler to use decoupled services and `guest_id`.
  - [route.ts](file:///e:/K4NN4N/Threadly/apps/web/app/api/clue/route.ts): Created progressive clue validation endpoint.
  - [page.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/page.tsx): Updated guest ID reconciliation, guess payload, progressive fetch calls, and reset game state.

## Entry #3: Database-Backed Streaks, Stats, Difficulty Recalibration, and Leaderboards
- **Timestamp**: June 15, 2026, 5:15 PM
- **Why**: Transition client state tracking to a robust, server-side database model to support secure seasonal rankings and user telemetry tracking.
- **When**: Triggered by database-backed stats and leaderboard backlog requirements (Phase 2 & Phase 3).
- **How**:
  - Migrated `schema.prisma` to support guest user IDs on `Streak` and `Stats` tables, added multi-category junction tables, and added seasonal leaderboard models.
  - Implemented decoupled services under `apps/web/services`: `streakService.ts`, `statsService.ts`, `difficultyService.ts` (Dynamic Difficulty Engine).
  - Created a new `/api/leaderboard` endpoint handling seasonal entries and GET lists.
  - Refactored `/api/guess` POST handler to invoke streak/stats increments, log scores to leaderboard seasons, and recalculate dynamic puzzle difficulty.
- **Files Changed**:
  - [schema.prisma](file:///e:/K4NN4N/Threadly/apps/web/prisma/schema.prisma): Extended schema models.
  - [page.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/page.tsx): Updated page component to consume database-backed streak payloads from server.
  - [route.ts](file:///e:/K4NN4N/Threadly/apps/web/app/api/guess/route.ts): Refactored guess processor to trigger services.
  - [route.ts](file:///e:/K4NN4N/Threadly/apps/web/app/api/leaderboard/route.ts): Created new leaderboard route.
  - [streakService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/streakService.ts): Created streak logic service.
  - [statsService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/statsService.ts): Created stats telemetry service.
  - [difficultyService.ts](file:///e:/K4NN4N/Threadly/apps/web/services/difficultyService.ts): Created difficulty mapping system.

## Entry #4: Light and Dark Theme Switcher
- **Timestamp**: June 15, 2026, 5:20 PM
- **Why**: Improve user experience and visual accessibility by allowing players to choose between the default premium dark neumorphic styling and a clean light neumorphic styling.
- **When**: Triggered by user request for a theme switcher.
- **How**:
  - Defined CSS custom properties for background, foreground, neumorphic outset/inset shadows, and subtle borders in both default (dark) and `[data-theme="light"]` selectors inside `globals.css`.
  - Linked CSS variables to TailwindCSS v4 `@theme` configuration.
  - Added theme state hook (`theme`, `setTheme`) in `page.tsx` initialized from `localStorage`.
  - Implemented `toggleTheme()` to update the `data-theme` attribute on `document.documentElement` and persist in storage.
  - Refactored layout styling classes to use theme-agnostic design tokens (`bg-background`, `text-foreground`, `text-foreground/85` etc.) instead of hardcoded dark values.
  - Placed an interactive sun/moon toggle button in the header.
- **Files Changed**:
  - [globals.css](file:///e:/K4NN4N/Threadly/apps/web/app/globals.css): Created theme-specific shadows and custom colors.
  - [page.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/page.tsx): Added toggle button, localStorage synchronization, and theme-neutral layout tokens.

## Entry #5: Layout Cleanups and Outline Fixes
- **Timestamp**: June 15, 2026, 5:25 PM
- **Why**: Fix the theme switcher not functioning and remove the thick white outlines on the neumorphic card boxes.
- **When**: Triggered by bug reports regarding switcher functionality and visual outline issues.
- **How**:
  - Modified [layout.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/layout.tsx) to remove the hardcoded `dark` class from the `html` tag and the hardcoded `bg-[#0E1113]` and `text-[#D7DADC]` classes from the `body` tag, allowing the dynamic CSS variables in `globals.css` to govern background and text styles.
  - Defined `--color-border-subtle: var(--border-subtle);` inside `@theme` in `globals.css` to enable low-opacity borders in Tailwind.
  - Replaced all raw border opacity mappings in `page.tsx` with `border border-border-subtle`, which makes the outlines almost invisible in dark mode and perfectly light in light mode, preserving the neumorphic look.
- **Files Changed**:
  - [layout.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/layout.tsx): Removed hardcoded dark-mode background/text classes.
  - [globals.css](file:///e:/K4NN4N/Threadly/apps/web/app/globals.css): Defined `--color-border-subtle` mapping.
  - [page.tsx](file:///e:/K4NN4N/Threadly/apps/web/app/page.tsx): Replaced arbitrary outline border declarations with `border-border-subtle`.

## Entry #6: Documentation Sync and Backlog Updates
- **Timestamp**: June 15, 2026, 5:30 PM
- **Why**: Keep project documentation up to date with the completed Phase 2 and Phase 3 MVP deliverables.
- **When**: Triggered by user request to update docs.
- **How**:
  - Checked off completed tickets (Phase 1, Phase 2, Phase 3, Phase 8) inside `17-task-backlog.md`.
  - Added new column listings and indexes in `02-database.md`.
  - Added specifications for new progressive clue reveals and seasonal leaderboard endpoint payloads in `03-api.md`.
  - Updated phase milestones to mark completion of secure clues, streaks, leaderboards, and the difficulty engine inside `06-roadmap.md`.
- **Files Changed**:
  - [17-task-backlog.md](file:///e:/K4NN4N/Threadly/docs/17-task-backlog.md): Checked off completed tickets.
  - [02-database.md](file:///e:/K4NN4N/Threadly/docs/02-database.md): Documented new database schemas.
  - [03-api.md](file:///e:/K4NN4N/Threadly/docs/03-api.md): Documented updated/new API contracts.
  - [06-roadmap.md](file:///e:/K4NN4N/Threadly/docs/06-roadmap.md): Updated milestone achievements.





