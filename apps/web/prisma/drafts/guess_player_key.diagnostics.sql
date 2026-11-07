-- Read-only checks to run BEFORE the migration (report numbers to the owner).
-- A) legacy duplicate groups that would keep only their earliest row keyed:
SELECT count(*) AS duplicate_groups, coalesce(sum(n - 1), 0) AS rows_left_unkeyed
FROM (SELECT puzzle_id, coalesce('u:' || user_id, 'g:' || guest_id) AS k, clue_number, count(*) AS n
      FROM guesses WHERE user_id IS NOT NULL OR guest_id IS NOT NULL
      GROUP BY 1, 2, 3 HAVING count(*) > 1) d;
-- B) anonymous rows (no user and no guest) that will never be keyed:
SELECT count(*) AS anonymous_rows FROM guesses WHERE user_id IS NULL AND guest_id IS NULL;
-- C) players whose history has a gap or a guess after a correct one (legacy inconsistency):
SELECT count(*) AS players_with_guess_after_solve FROM (
  SELECT puzzle_id, coalesce('u:' || user_id, 'g:' || guest_id) AS k
  FROM guesses WHERE user_id IS NOT NULL OR guest_id IS NOT NULL
  GROUP BY 1, 2
  HAVING max(clue_number) > min(clue_number) FILTER (WHERE is_correct)) x;
