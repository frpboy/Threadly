# 📋 Execution Task Backlog

> [!NOTE]
> This is the master backlog for Claude Code, Cursor, and other autonomous coding agents.
> It contains exactly 150 atomic, actionable tasks structured sequentially.

## 🛠️ Phase 1: Core Game Engine & Security (TASK-001 - TASK-015)
- **[x] TASK-001:** Modify `schema.prisma` to add unique constraints and index on `publishedDate` to optimize daily puzzle queries.
- **[x] TASK-002:** Restructure `/api/daily` to return only the first clue (`clueOrder: 1`) to prevent front-end client cheating.
- **[x] TASK-003:** Create `/api/clue` POST endpoint to securely return subsequent clues *only* if the player's guess log confirms they have attempted to guess on the current clue.
- **[x] TASK-004:** Extract string matching logic and similarity calculations into `services/answerService.ts` for clean separation.
- **[x] TASK-005:** Create `services/puzzleService.ts` for handling Daily and Archive database queries.
- **[x] TASK-006:** Create `services/scoringService.ts` to calculate points based on clues used, time elapsed, and daily multipliers.
- **[ ] TASK-007:** Implement guess rate limiter middleware (e.g. max 10 guesses per minute per IP) to prevent brute-forcing.
- **[ ] TASK-008:** Add support for multiple acceptable target answers in the schema (e.g. comma-separated string or related terms array).
- **[ ] TASK-009:** Encrypt answer strings in the database using a cryptographic hash or secret key to prevent direct DB leak viewing.
- **[ ] TASK-010:** Add server-side timestamp validation to verify guess submissions happen within the active day.
- **[x] TASK-011:** Implement a guest/session identifier mechanism to trace guess history for anonymous players without requiring signup.
- **[ ] TASK-012:** Write unit tests for Levenshtein distance matching logic in `services/answerService.ts`.
- **[ ] TASK-013:** Add automated integration tests verifying cheat prevention on progressive clue reveals.
- **[ ] TASK-014:** Implement validation to prevent duplicate guess submission on the client side.
- **[ ] TASK-015:** Write database seed script to populate puzzle DB with 30 days of high-quality testing puzzles.

## 🗃️ Phase 2: Database Schema & Migrations (TASK-016 - TASK-030)
- **[x] TASK-016:** Add `Category` model to `schema.prisma` with relation to `Puzzle`.
- **[x] TASK-017:** Add `LeaderboardSeason` and `LeaderboardEntry` tables to support seasonal rankings.
- **[x] TASK-018:** Update `Guess` table to include `guestId` or `sessionId` for anonymous logging.
- **[ ] TASK-019:** Add `abandoned` status to puzzle play states for metric recording.
- **[x] TASK-020:** Set up database migration scripts on Neon PostgreSQL for category/seasonal schema extensions.
- **[ ] TASK-021:** Add index on `userId` and `earnedAt` in `UserAchievement` for faster profile queries.
- **[ ] TASK-022:** Configure cascade deletions for `User` profiles to automatically clean up all child tables.
- **[ ] TASK-023:** Add a `difficulty` metadata cache table to store aggregated completion statistics.
- **[ ] TASK-024:** Create a database views migration for monthly/yearly leaderboards aggregation.
- **[ ] TASK-025:** Add migration to store daily streak history to prevent streak manipulation.
- **[ ] TASK-026:** Create `PrismaClient` singleton utility to prevent hot-reload connection leaks.
- **[ ] TASK-027:** Implement a database backup verification script using Neon CLI.
- **[x] TASK-028:** Add a `puzzles_categories` junction table to support multi-category tagging.
- **[ ] TASK-029:** Create indexing strategy on foreign keys in Prisma schemas to prevent slow joins.
- **[x] TASK-030:** Document Prisma Schema and ERD diagram layout inside `/docs/02-database.md`.

## 🔌 Phase 3: API Layer Implementation (TASK-031 - TASK-050)
- **[ ] TASK-031:** Create `/api/archive` GET route for retrieving past puzzles (excluding answers for unsolved ones).
- **[ ] TASK-032:** Create `/api/archive/[id]` GET route for playing a specific past puzzle.
- **[ ] TASK-033:** Build `/api/profile` endpoint to fetch user statistics, active achievements, and current streaks.
- **[ ] TASK-034:** Implement `/api/leaderboards/seasonal` route for seasonal ranking views.
- **[ ] TASK-035:** Implement `/api/leaderboards/global` route for all-time high score logs.
- **[ ] TASK-036:** Create `/api/achievements` GET endpoint to list all available achievements and check unlocked states.
- **[ ] TASK-037:** Build `/api/stats/summary` to return aggregated dashboard charts telemetry.
- **[ ] TASK-038:** Implement `/api/admin/puzzles` POST endpoint to allow manual puzzle creation.
- **[ ] TASK-039:** Implement `/api/admin/puzzles/[id]` PUT/DELETE endpoint for editing scheduled clues.
- **[x] TASK-040:** Implement post-solve DB hook to calculate and update active streaks in the Neon PostgreSQL database.
- **[x] TASK-041:** Create client-side synchronization hook in Next.js to reconcile local guest states with authenticated user DB states.
- **[ ] TASK-042:** Build `/api/categories` endpoint returning the active list of gameplay categories.
- **[ ] TASK-043:** Create `/api/share` POST route to register and generate metadata for external share cards.
- **[ ] TASK-044:** Add comprehensive JSON response verification middleware on all public endpoints.
- **[ ] TASK-045:** Implement API logging middleware to trace request timing and database query latencies.
- **[ ] TASK-046:** Build `/api/feedback` endpoint for users to report incorrect clues or bug reports.
- **[ ] TASK-047:** Set up CORS policy configurations for public endpoints in Next.js middleware.
- **[ ] TASK-048:** Create `/api/health` sanity checker endpoint for uptime verification.
- **[ ] TASK-049:** Implement global error handler helper mapping database exceptions to safe client messages.
- **[ ] TASK-050:** Write OpenAPISpec/Swagger documentation for all API routes in `/docs/21-api-contracts.md`.

## 🎨 Phase 4: Frontend Pages & Components (TASK-051 - TASK-070)
- **[ ] TASK-051:** Create the landing page layout with options for Daily Play, Archive, and Leaderboards.
- **[ ] TASK-052:** Build the Neumorphic Game Panel component supporting progressive animations.
- **[ ] TASK-053:** Implement Neumorphic keyboard/input component for smooth interactive gameplay.
- **[ ] TASK-054:** Create custom Neumorphic Modals for "How to Play" and "Game Over" states.
- **[ ] TASK-055:** Build the Archive page layout (`/archive`) with pagination and category search filters.
- **[ ] TASK-056:** Build the Leaderboard page layout (`/leaderboard`) showing seasonal vs all-time rankings.
- **[ ] TASK-057:** Create the User Profile dashboard (`/profile`) showcasing unlocked badges, stats, and graphs.
- **[ ] TASK-058:** Build the Admin Panel dashboard layout (`/admin`) for scheduling and editing puzzles.
- **[ ] TASK-059:** Implement the responsive Navigation Bar component matching dark Neo-skeuomorphic styling.
- **[ ] TASK-060:** Create animated transitions between views using Framer Motion or pure CSS animations.
- **[ ] TASK-061:** Build the Share Card generator component matching the premium HSL palettes.
- **[ ] TASK-062:** Create standard layout wrapper with consistent max-width constraint for mobile optimization.
- **[ ] TASK-063:** Build loading state skeleton placeholders for puzzle card blocks.
- **[ ] TASK-064:** Design and build CSS-only LED status indicator representing active gameplay state.
- **[ ] TASK-065:** Implement dark-theme optimization to avoid layout shifting during font downloads.
- **[ ] TASK-066:** Build UI verification panel to test responsiveness on simulated mobile screens.
- **[ ] TASK-067:** Create error boundary component for catching rendering exceptions elegantly.
- **[ ] TASK-068:** Implement a custom component for displaying similarity-score feedback gauges.
- **[ ] TASK-069:** Build a dynamic calendar widget for admin scheduling interface.
- **[ ] TASK-070:** Audit all custom buttons to confirm proper active/pressed neumorphic state shifts.

## 🧠 Phase 5: State Management & Hooks (TASK-071 - TASK-085)
- **[ ] TASK-071:** Integrate Zustand for global store definition.
- **[ ] TASK-072:** Create `useGameStore` to manage gameplay, guessed connection lists, and score stats.
- **[ ] TASK-073:** Build `useStreakStore` managing active streaks and syncing logic.
- **[ ] TASK-074:** Implement `useAuthStore` interfacing Session states with frontend routes.
- **[ ] TASK-075:** Create custom React hook `useShareCard` to copy game grids with HSL gradient styles.
- **[ ] TASK-076:** Build `useLocalStorage` hook handling persistent theme config and offline history.
- **[ ] TASK-077:** Implement action in `useGameStore` to fetch progressive clues asynchronously.
- **[ ] TASK-078:** Create state handlers for modal toggle visibility states.
- **[ ] TASK-079:** Build custom hook `useConfetti` to trigger visual particle celebration upon correct guess.
- **[ ] TASK-080:** Implement debouncing hook for search input changes on the Archive page.
- **[ ] TASK-081:** Create store slice for managing admin page puzzle configurations.
- **[ ] TASK-082:** Implement telemetry wrapper inside state hooks to log action duration metrics.
- **[ ] TASK-083:** Write unit tests for store mutations and state transitions.
- **[ ] TASK-084:** Ensure state resets completely when switching between different puzzles.
- **[ ] TASK-085:** Implement offline warning indicator hook detecting network disruptions.

## 🔐 Phase 6: Authentication & User Management (TASK-086 - TASK-100)
- **[ ] TASK-086:** Set up NextAuth.js configuration using the Neon PostgreSQL database adapter.
- **[ ] TASK-087:** Integrate Neon Auth credentials endpoint provider.
- **[ ] TASK-088:** Implement OIDC-compliant authentication routes using NextAuth config.
- **[ ] TASK-089:** Build User sign-up, sign-in, and sign-out pages matching Neumorphic theme rules.
- **[ ] TASK-090:** Create secure middleware to protect admin routes (`/admin/*`) from unauthorized requests.
- **[ ] TASK-091:** Add user role parameter (`role: 'user' | 'admin'`) to the NextAuth session payload.
- **[ ] TASK-092:** Create profile edit endpoint allowing users to modify their nickname or avatars.
- **[ ] TASK-093:** Implement password reset flow using secure JWT verification tokens.
- **[ ] TASK-094:** Build client-side authentication guards preventing unauthenticated players from viewing seasonal rankings.
- **[ ] TASK-095:** Implement account deletion mechanism that complies with data privacy laws.
- **[ ] TASK-096:** Add social login options (Google, GitHub) within NextAuth adapter options.
- **[ ] TASK-097:** Implement database triggers updating `lastSeen` column on successful user session creation.
- **[ ] TASK-098:** Write E2E authentication flow tests using Playwright.
- **[ ] TASK-099:** Add login rate limits to defend against brute force attempts on account credentials.
- **[ ] TASK-100:** Document Auth state mappings and middleware configs inside `/docs/08-security.md`.

## 🏆 Phase 7: Leaderboards & Seasons (TASK-101 - TASK-115)
- **[ ] TASK-101:** Create a cron job to automatically rollover seasonal leaderboards every 30 days.
- **[ ] TASK-102:** Implement seasonal scoring rules allocating bonus multipliers for fast puzzle solves.
- **[ ] TASK-103:** Build interactive Leaderboard UI displays highlighting top 3 players with golden indicators.
- **[ ] TASK-104:** Create custom filters on Leaderboard UI allowing users to view friend rankings vs global lists.
- **[ ] TASK-105:** Add DB indices to speed up queries grouping scores by season.
- **[ ] TASK-106:** Implement fallback seed logic creating seasonal records if none exist in the DB.
- **[ ] TASK-107:** Create achievement triggers for placing first in a season leaderboard.
- **[ ] TASK-108:** Add UI panel showing previous seasons winners history.
- **[ ] TASK-109:** Build endpoint `/api/leaderboard/join` allowing private user groups creation.
- **[ ] TASK-110:** Create user search features inside leaderboard friend groups.
- **[ ] TASK-111:** Implement anti-cheat validation verifying user high scores don't exceed daily max potential bounds.
- **[ ] TASK-112:** Add user profile popup triggers when clicking leaderboard avatars.
- **[ ] TASK-113:** Implement ranking shift animations when scoring ranks update in real-time.
- **[ ] TASK-114:** Build seasonal badge icons to be displayed on top player cards.
- **[ ] TASK-115:** Create unit tests verifying seasonal score accumulations run correctly on Neon DB.

## 🤖 Phase 8: AI Puzzle Generation & Difficulty Engine (TASK-116 - TASK-130)
- **[x] TASK-116:** Create the Difficulty Engine calculating difficulty score (1-10) based on average solve rate and clue reveal counts.
- **[ ] TASK-117:** Integrate Gemini API wrapper to generate daily puzzles (connection theme + 5 progressive clues).
- **[ ] TASK-118:** Write prompts forcing Gemini to yield strict JSON payloads matching `Puzzle` models.
- **[ ] TASK-119:** Implement server-side check estimating clue difficulty based on dictionary lookup frequencies.
- **[ ] TASK-120:** Add database log table tracking `abandonmentRate` for active puzzles.
- **[ ] TASK-121:** Build AI puzzle validation script analyzing word similarity between clues to prevent duplicate hints.
- **[ ] TASK-122:** Create auto-draft pipeline saving AI-generated puzzles into the database for admin approval.
- **[ ] TASK-123:** Implement Levenshtein-based filter verifying new puzzles don't repeat answers of last 90 days.
- **[ ] TASK-124:** Add automatic translation options for AI puzzle generator pipeline.
- **[ ] TASK-125:** Build difficulty score recalibration script that runs weekly to adjust difficulty ranks.
- **[ ] TASK-126:** Implement automated email/Slack warning alerts if scheduled published puzzles run low.
- **[ ] TASK-127:** Create a manual testing suite for the AI Puzzle generator.
- **[ ] TASK-128:** Add clue relevance scoring using NLP embed models.
- **[ ] TASK-129:** Implement automated difficulty checks tagging abstract vs concrete noun connections.
- **[ ] TASK-130:** Document AI generation system details in `/docs/25-ai-puzzle-generation.md`.

## 🛡️ Phase 9: Admin Panel & Moderation (TASK-131 - TASK-140)
- **[ ] TASK-131:** Implement Admin Calendar UI showing puzzle schedules.
- **[ ] TASK-132:** Build puzzle moderation queue page inside `/admin/moderation`.
- **[ ] TASK-133:** Create a profanity filter checking user feedback logs before DB saving.
- **[ ] TASK-134:** Implement toggle enabling admins to immediately publish draft puzzles.
- **[ ] TASK-135:** Build a feedback report review dashboard for handling flag counts.
- **[ ] TASK-136:** Add action logs recording admin changes to historical puzzles.
- **[ ] TASK-137:** Implement user banning system from leaderboards in case of cheating.
- **[ ] TASK-138:** Build static file exports enabling admins to back up the puzzle deck locally.
- **[ ] TASK-139:** Implement database clean-up scripts removing guest guesses older than 90 days.
- **[ ] TASK-140:** Create test suites verifying admin-only authorization middleware on all dashboard panels.

## 🚀 Phase 10: DevOps, Analytics & Release Checklist (TASK-141 - TASK-150)
- **[ ] TASK-141:** Integrate Sentry error logging on all client components and API endpoints.
- **[ ] TASK-142:** Configure Plausible Analytics tracker capturing gameplay completion metrics.
- **[ ] TASK-143:** Build automated database schema validation script for production migrations.
- **[ ] TASK-144:** Set up CI/CD pipeline on GitHub Actions verifying code compilation and lint checks.
- **[ ] TASK-145:** Generate dynamic `sitemap.xml` mapping the homepage and archive lists for SEO.
- **[ ] TASK-146:** Configure custom metadata tags and JSON-LD schema for social preview share cards.
- **[ ] TASK-147:** Implement robots.txt to properly guide search index bots.
- **[ ] TASK-148:** Conduct a load test validating Neon PostgreSQL pooler thresholds.
- **[ ] TASK-149:** Optimize bundle size by lazy loading modal components.
- **[ ] TASK-150:** Run the final Release Checklist script to compile target assets for deploy.