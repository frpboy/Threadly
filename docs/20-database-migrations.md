# 🗃️ Database Migrations Log

All migrations are run via Prisma directly targeting the Neon PostgreSQL instance.

### Migration `20260615_init`
- Creates initial `users`, `puzzles`, `clues`, `guesses`, `streaks`, `stats`, `achievements`, and `leaderboards` tables.
- Implements cascade delete relations.

### Migration `20260615_nullable_guesses`
- Makes `user_id` optional in `guesses` to support anonymous plays.
