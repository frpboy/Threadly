// Exercises submitGuess against a REAL Postgres engine (PGlite, WASM) using the same INSERT SQL as production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { submitGuess } from "../guessTransaction.ts";
import { INSERT_GUESS_SQL } from "../guessSql.ts";
import type { GuessUnitOfWork } from "../guessTransaction.ts";

const up = readFileSync(new URL("../../prisma/drafts/guess_player_key.up.sql", import.meta.url), "utf8");

async function freshDb() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE guesses (id text primary key, user_id text, guest_id text, puzzle_id text not null,
    guess_text text not null, is_correct boolean not null default false, clue_number int not null,
    created_at timestamp(3) not null default now());
    CREATE TABLE awards (player_key text not null, points int not null, games int not null default 0);`);
  await db.exec(up); // the real draft migration
  return db;
}
let n = 0;
function runner(db: PGlite, failAward?: "before" | "after") {
  return (<T,>(fn: (uow: GuessUnitOfWork) => Promise<T>) =>
    db.transaction(async (tx) => {
      const uow: GuessUnitOfWork = {
        async history(puzzleId, playerKey) {
          const r = await tx.query<any>("SELECT clue_number, is_correct, guess_text FROM guesses WHERE puzzle_id=$1 AND player_key=$2 ORDER BY clue_number", [puzzleId, playerKey]);
          return r.rows.map((x) => ({ clueNumber: x.clue_number, isCorrect: x.is_correct, guessText: x.guess_text, scoreAwarded: 0 }));
        },
        async insertGuess(puzzleId, playerKey, rec) {
          const isUser = playerKey.startsWith("u:"), id = playerKey.slice(2);
          const r = await tx.query(INSERT_GUESS_SQL, ["id" + ++n, isUser ? id : null, isUser ? null : id, puzzleId, rec.guessText, rec.isCorrect, rec.clueNumber, playerKey]);
          return (r.affectedRows ?? 0) === 1 ? "inserted" : "conflict";
        },
        async award(a) {
          if (failAward === "before") throw new Error("crash before award");
          await tx.query("INSERT INTO awards(player_key, points, games) VALUES ($1,$2,$3)", [a.playerKey, a.scoreAwarded, a.finished ? 1 : 0]);
          if (failAward === "after") throw new Error("crash after award, before commit");
        },
      };
      return fn(uow);
    })) as any;
}
const score = (c: number) => Math.max(20, 120 - c * 20);
const args = (correct: boolean, text = "x") => ({ puzzleId: "p", playerKey: "g:abc12345", guessText: text, isCorrect: correct, scoreFor: score });
const count = async (db: PGlite, t: string) => Number((await db.query<any>(`SELECT count(*)::int c FROM ${t}`)).rows[0].c);

test("happy path: one guess row and one award row, committed together", async () => {
  const db = await freshDb();
  const r: any = await submitGuess(runner(db), args(true));
  assert.equal(r.outcome.status, "scored");
  assert.equal(await count(db, "guesses"), 1); assert.equal(await count(db, "awards"), 1);
  assert.equal((await db.query<any>("SELECT points, games FROM awards")).rows[0].points, 100);
});

test("crash BEFORE award: guess row rolls back, so a retry is scored (not treated as a replay)", async () => {
  const db = await freshDb();
  await assert.rejects(submitGuess(runner(db, "before"), args(true)), /crash before award/);
  assert.equal(await count(db, "guesses"), 0); assert.equal(await count(db, "awards"), 0);
  const retry: any = await submitGuess(runner(db), args(true));
  assert.equal(retry.outcome.status, "scored");
  assert.equal(await count(db, "guesses"), 1); assert.equal(await count(db, "awards"), 1);
});

test("crash AFTER award but before commit: both roll back, retry awards exactly once", async () => {
  const db = await freshDb();
  await assert.rejects(submitGuess(runner(db, "after"), args(true)), /crash after award/);
  assert.equal(await count(db, "guesses"), 0); assert.equal(await count(db, "awards"), 0);
  await submitGuess(runner(db), args(true));
  assert.equal(await count(db, "awards"), 1);
});

test("client retry after a successful commit is a replay-safe no-op (already solved), no second award", async () => {
  const db = await freshDb();
  await submitGuess(runner(db), args(true));
  const again: any = await submitGuess(runner(db), args(true));
  assert.equal(again.outcome.status, "already_solved");
  assert.equal(await count(db, "awards"), 1);
});

test("wrong guesses do not count a finished game until clue 5", async () => {
  const db = await freshDb();
  for (let i = 0; i < 4; i++) await submitGuess(runner(db), args(false, "w" + i));
  assert.equal((await db.query<any>("SELECT coalesce(sum(games),0)::int g FROM awards")).rows[0].g, 0);
  await submitGuess(runner(db), args(false, "w5"));
  assert.equal((await db.query<any>("SELECT coalesce(sum(games),0)::int g FROM awards")).rows[0].g, 1);
  const extra: any = await submitGuess(runner(db), args(true));
  assert.equal(extra.outcome.status, "exhausted");
});
