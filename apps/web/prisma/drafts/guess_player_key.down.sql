-- Rollback for guess_player_key.up.sql. Data in other columns is untouched.
BEGIN;
DROP INDEX IF EXISTS guesses_puzzle_player_clue_uq;
ALTER TABLE guesses DROP COLUMN IF EXISTS player_key;
COMMIT;
