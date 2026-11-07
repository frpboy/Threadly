import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveState, processGuess } from "../attemptService.ts";
import type { AttemptStore, GuessRecord } from "../attemptService.ts";
function memoryStore(): AttemptStore & { rows: Map<string, GuessRecord[]> } {
  const rows = new Map<string, GuessRecord[]>();
  const key = (p: string, k: string) => `${p}|${k}`;
  return {
    rows,
    async history(p, k) {
      await Promise.resolve(); // yield, so concurrent callers can read the same snapshot
      return [...(rows.get(key(p, k)) ?? [])];
    },
    async insertGuess(p, k, rec) {
      await Promise.resolve();
      const list = rows.get(key(p, k)) ?? [];
      if (list.some((r) => r.clueNumber === rec.clueNumber)) return "conflict"; // unique constraint
      list.push(rec);
      rows.set(key(p, k), list);
      return "inserted";
    },
  };
}
const score = (n: number) => Math.max(20, 120 - n * 20);
const g = (store: AttemptStore, isCorrect: boolean, text = "x") =>
  processGuess(store, { puzzleId: "p", playerKey: "guest:a", guessText: text, isCorrect, scoreFor: score });

test("fresh player starts on clue 1", () => {
  assert.deepEqual(deriveState([]), { kind: "open", clueNumber: 1 });
});

test("client cannot claim fewer clues: score comes from server history", async () => {
  const s = memoryStore();
  await g(s, false); await g(s, false); // clues 1 and 2 used
  const r = await g(s, true);           // solves on clue 3
  assert.deepEqual(r, { status: "scored", correct: true, cluesUsed: 3, scoreAwarded: 60 });
});

test("first-try solve scores 100", async () => {
  const s = memoryStore();
  assert.deepEqual(await g(s, true), { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 });
});

test("solved puzzle cannot be scored again", async () => {
  const s = memoryStore();
  await g(s, true);
  const again = await g(s, true);
  assert.equal(again.status, "already_solved");
  assert.equal((again as any).scoreAwarded, 100);
});

test("exhausted after five wrong guesses", async () => {
  const s = memoryStore();
  for (let i = 0; i < 5; i++) assert.equal((await g(s, false)).status, "scored");
  assert.equal((await g(s, true)).status, "exhausted");
});

test("concurrent identical requests: exactly one is scored", async () => {
  const s = memoryStore();
  const results = await Promise.all([g(s, true), g(s, true), g(s, true), g(s, true)]);
  assert.equal(results.filter((r) => r.status === "scored").length, 1);
  assert.equal(results.filter((r) => r.status === "replay").length, 3);
  assert.equal(s.rows.get("p|guest:a")!.length, 1);
});

test("different players are independent", async () => {
  const s = memoryStore();
  await g(s, false);
  const other = await processGuess(s, { puzzleId: "p", playerKey: "guest:b", guessText: "x", isCorrect: true, scoreFor: score });
  assert.deepEqual(other, { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 });
});
