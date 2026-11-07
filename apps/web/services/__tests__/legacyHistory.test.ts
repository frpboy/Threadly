import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { SELECT_HISTORY_SQL } from "../guessSql.ts";
import { deriveState } from "../attemptService.ts";
const up = readFileSync(new URL("../../prisma/drafts/guess_player_key.up.sql", import.meta.url), "utf8");
async function fresh() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE guesses (id text primary key, user_id text, guest_id text, puzzle_id text,
    guess_text text, is_correct boolean, clue_number int, created_at timestamp default now());`);
  await db.exec(up); return db;
}
async function add(db: PGlite, id: string, key: string | null, correct: boolean, clue = 1, user: string | null = null) {
  await db.query(`INSERT INTO guesses (id,user_id,guest_id,puzzle_id,guess_text,is_correct,clue_number,player_key)
    VALUES ($1,$2,'guest123','p',$1,$3,$4,$5)`, [id, user, correct, clue, key]);
}
const history = async (db: PGlite) => (await db.query<any>(SELECT_HISTORY_SQL, ["p", "g:guest123", null, "guest123"])).rows;
test("old-route NULL-key solve after migration remains solved and cannot be re-awarded", async () => {
  const db = await fresh();
  try { await add(db, "old", null, true); const h = await history(db); assert.equal(h.length, 1); assert.equal(deriveState(h).kind, "solved"); }
  finally { await db.close(); }
});
test("legacy correct duplicate is not hidden by migrated earlier wrong guess; unrelated users excluded", async () => {
  const db = await fresh();
  try {
    await add(db, "wrong", "g:guest123", false); await add(db, "correct", null, true);
    await add(db, "other-user", null, true, 2, "user1");
    const h = await history(db); assert.equal(h.length, 1); assert.equal(h[0].isCorrect, true);
  } finally { await db.close(); }
});
test("catch-up migration is repeatable even when newer keyed slot and older legacy row coexist", async () => {
  const db = await fresh();
  try {
    await add(db, "a-old", null, false); await add(db, "b-keyed", "g:guest123", false);
    await db.exec(up); await db.exec(up);
    assert.equal(Number((await db.query<any>("SELECT count(*) AS n FROM guesses")).rows[0].n), 2);
    assert.equal((await history(db)).length, 1);
  } finally { await db.close(); }
});
