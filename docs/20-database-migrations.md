# Database migration safety

## Actual repository state

The web schema is `apps/web/prisma/schema.prisma`. This branch has draft SQL under `apps/web/prisma/drafts`, not a checked-in Prisma migration history. Earlier descriptions of `20260615_init` and `20260615_nullable_guesses` were design notes, not evidence that those migrations exist or ran on a target.

The nullable `playerKey` schema field alone does not enforce the partial unique index required by `prismaAttemptStore.ts`. `guess_player_key.up.sql` adds/backfills that field and creates `guesses_puzzle_player_clue_uq` on `(puzzle_id, player_key, clue_number)` where `player_key IS NOT NULL`. A generic `prisma db push` is not a substitute for that SQL index.

## Isolated local development database

A fresh `DATABASE_URL` does not create the tables or the partial unique index used by the transactional guess store. For local development, create a disposable PostgreSQL database and apply the repository schema plus the draft index explicitly.

Example using Docker from the repository root:

```sh
docker run --name threadly-dev-db \
  -e POSTGRES_DB=threadly_dev \
  -e POSTGRES_USER=threadly \
  -e POSTGRES_PASSWORD=local-only-change-this \
  -p 54329:5432 \
  -v threadly-dev-db:/var/lib/postgresql/data \
  -d postgres:16

export DATABASE_URL='postgresql://threadly:local-only-change-this@127.0.0.1:54329/threadly_dev?schema=public'
cd apps/web
npx prisma generate
npx prisma db push
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/drafts/guess_player_key.up.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT indexdef FROM pg_indexes WHERE indexname = 'guesses_puzzle_player_clue_uq';"
npm test
```

The final query must return the expected partial unique index definition before exercising the transaction-backed guess route. Use a new local-only database or a verified disposable copy; do not reuse credentials or a connection string from Preview or Production. The password above is a placeholder for a local container, not an application credential.

`prisma db push` synchronizes the Prisma schema only. The separate draft SQL is needed for the partial unique index because that predicate is not represented by `schema.prisma`. This is a local development setup, not approval to apply the draft to an existing shared or production database. Production still requires the target-specific diagnostics, backup, migration review and explicit approval described below.

## Draft behavior and compatibility

Read all three files before planning a target operation:

- `guess_player_key.diagnostics.sql`: read-only identity/duplicate diagnostics.
- `guess_player_key.up.sql`: transactional nullable-column/backfill/index draft.
- `guess_player_key.down.sql`: rollback draft. Rollback is a separate data/schema decision, not an automatic test cleanup step.

The up draft keys the earliest eligible row per player/puzzle/clue. Later duplicate rows keep a NULL key and are not deleted. Production history reads use a canonical legacy-identity fallback, including a preference for a correct duplicate; a keyed row alone is not the complete legacy history. Account and guest scopes must stay separate.

This index limits one keyed guess per clue. It does **not** identify a retried logical HTTP request. A committed wrong guess whose response is lost can be retried on the next clue unless a separately implemented durable attempt protocol prevents that. Local protocol tests are not evidence that the live API or Android client has that protocol.

## Before a deployment

1. Identify the actual target, role, branch, database and existing rows. Preview and Production labels do not prove separate databases.
2. Obtain explicit approval for any production migration. Preserve a verified backup and supported recovery route before changing existing data.
3. Run the read-only diagnostics on an approved target. Check duplicate identity cases, null identities, canonical history and expected index definition. `IF NOT EXISTS` alone does not prove an existing index has the required definition.
4. Rehearse against an isolated copy that represents existing data, not just an empty schema. Test upgrade compatibility, concurrent writers and rollback implications.
5. Apply only the reviewed target-specific plan, then verify index definition, preserved rows, authoritative progress and replay behavior before enabling dependent routes.

No production migration is claimed by this document. Existing empty local PostgreSQL and disposable Android QA tests establish only their own synthetic-data scope. Never seed synthetic fixtures or run `db push` against an inherited production connection.
