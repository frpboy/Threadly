# Database migration safety

## Actual repository state

The web schema is `apps/web/prisma/schema.prisma`. This branch has draft SQL under `apps/web/prisma/drafts`, not a checked-in Prisma migration history. Earlier descriptions of `20260615_init` and `20260615_nullable_guesses` were design notes, not evidence that those migrations exist or ran on a target.

The nullable `playerKey` schema field alone does not enforce the partial unique index required by `prismaAttemptStore.ts`. `guess_player_key.up.sql` adds/backfills that field and creates `guesses_puzzle_player_clue_uq` on `(puzzle_id, player_key, clue_number)` where `player_key IS NOT NULL`. A generic `prisma db push` is not a substitute for that SQL index.

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
