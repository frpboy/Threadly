-- DRAFT, NOT APPLIED. Do not run against production without an explicit go-ahead and a backup/branch of the DB.
-- Purpose: make "one scored guess per clue per player per puzzle" enforceable by the database.
-- Compatible with PostgreSQL 12+ (Neon). Runs in one transaction. No rows are deleted or rewritten except
-- the new nullable column player_key.

BEGIN;

-- 1) New nullable column. Nullable on purpose: legacy rows stay valid.
ALTER TABLE guesses ADD COLUMN IF NOT EXISTS player_key text;

-- 2) Backfill. player_key = 'u:<user_id>' for signed-in guesses, otherwise 'g:<guest_id>'.
--    Only the EARLIEST row per (puzzle, player, clue) gets a key. Later duplicates keep player_key NULL, so
--    nothing is deleted and the unique index below can be created. NULL-key rows remain visible through the legacy-identity history fallback.
WITH keyed AS (
  SELECT id,
         CASE WHEN user_id IS NOT NULL THEN 'u:' || user_id
              WHEN guest_id IS NOT NULL THEN 'g:' || guest_id END AS k,
         row_number() OVER (
           PARTITION BY puzzle_id,
                        CASE WHEN user_id IS NOT NULL THEN 'u:' || user_id
                             WHEN guest_id IS NOT NULL THEN 'g:' || guest_id END,
                        clue_number
           ORDER BY created_at, id) AS rn
  FROM guesses
)
UPDATE guesses g SET player_key = keyed.k
FROM keyed
WHERE g.id = keyed.id AND g.player_key IS NULL AND keyed.k IS NOT NULL AND keyed.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM guesses existing
    WHERE existing.puzzle_id = g.puzzle_id AND existing.player_key = keyed.k
      AND existing.clue_number = g.clue_number
  );

-- 3) The constraint. Partial, so rows with NULL player_key (legacy duplicates, anonymous rows) are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS guesses_puzzle_player_clue_uq
  ON guesses (puzzle_id, player_key, clue_number)
  WHERE player_key IS NOT NULL;

COMMIT;
