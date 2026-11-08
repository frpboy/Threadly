-- ADDITIVE DRAFT ONLY. Requires target/backup/role/retention review and explicit production approval.
-- No existing guesses, stats, user identities or legacy guest records are changed or backfilled.
-- No expiry, UPDATE, DELETE, down migration or cascade is provided: deleting a receipt can reopen a key.
-- Deliberately no inferred user/puzzle FK cascade. Current route rechecks account + puzzle visibility on replay.
BEGIN;
CREATE TABLE guess_attempt_receipts (
 player_key text NOT NULL CHECK(left(player_key,2)='u:' AND length(player_key) BETWEEN 3 AND 202),
 puzzle_id text NOT NULL CHECK(length(puzzle_id) BETWEEN 1 AND 100),
 attempt_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 status integer NOT NULL CHECK(status IN (200,409)),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object' AND octet_length(response::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player_key,puzzle_id,attempt_id)
);
COMMIT;
-- Re-running intentionally fails rather than accepting an unknown existing definition.
-- Least-privilege app-role INSERT/SELECT and no direct UPDATE/DELETE must be reviewed on the actual target.
