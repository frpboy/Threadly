// Shared SQL so the production (Prisma $executeRawUnsafe) and the PGlite tests run the exact same statement.
// Requires the partial unique index from prisma/drafts/guess_player_key.up.sql.
// Positional params: $1 id, $2 user_id, $3 guest_id, $4 puzzle_id, $5 guess_text, $6 is_correct, $7 clue_number, $8 player_key
export const INSERT_GUESS_SQL = `INSERT INTO guesses (id, user_id, guest_id, puzzle_id, guess_text, is_correct, clue_number, player_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (puzzle_id, player_key, clue_number) WHERE player_key IS NOT NULL DO NOTHING`;


// Include old-route NULL-key rows written between migration and deployment.
// A historical correct replay must never be hidden by an earlier wrong row in the same slot.
// DISTINCT ON caps history at one row per clue; it does not rewrite any historical data.
// Params: puzzle, player key, signed-in user id (or NULL), guest id (or NULL).
export const SELECT_HISTORY_SQL = `SELECT DISTINCT ON (clue_number)
  clue_number AS "clueNumber", is_correct AS "isCorrect", guess_text AS "guessText"
FROM guesses
WHERE puzzle_id = $1 AND (
  player_key = $2 OR
  (player_key IS NULL AND (($3::text IS NOT NULL AND user_id = $3)
    OR ($3::text IS NULL AND user_id IS NULL AND guest_id = $4)))
)
ORDER BY clue_number, is_correct DESC, created_at, id`;
