import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProgress } from "../progressService.ts";
import type { GuessRecord } from "../attemptService.ts";

const clues = [1, 2, 3, 4, 5].map((o) => ({ order: o, text: `clue${o}` }));
const score = (n: number) => Math.max(20, 120 - n * 20);
const rec = (clueNumber: number, isCorrect = false, guessText = `g${clueNumber}`): GuessRecord => ({ clueNumber, isCorrect, guessText, scoreAwarded: 0 });
const run = (history: GuessRecord[]) => buildProgress({ history, clues, answer: "the answer", scoreFor: score });

test("new player: clue 1 only, no answer", () => {
  const p = run([]);
  assert.equal(p.state, "open"); assert.equal(p.clue_number, 1);
  assert.deepEqual(p.clues.map((c) => c.order), [1]); assert.equal(p.answer, undefined); assert.deepEqual(p.guesses, []);
});

test("after two wrong guesses: clue 3 is open, clues 1-3 visible, no clue 4 or 5, no answer", () => {
  const p = run([rec(2), rec(1)]);
  assert.equal(p.clue_number, 3); assert.deepEqual(p.clues.map((c) => c.order), [1, 2, 3]);
  assert.deepEqual(p.guesses, ["g1", "g2"]); assert.equal(p.answer, undefined); assert.equal(JSON.stringify(p).includes("clue4"), false);
});

test("solved on clue 2: score from server, answer revealed, only unlocked clues", () => {
  const p = run([rec(1), rec(2, true)]);
  assert.equal(p.state, "solved"); assert.equal(p.score_awarded, 80); assert.equal(p.answer, "the answer");
  assert.deepEqual(p.clues.map((c) => c.order), [1, 2]);
});

test("exhausted: all five clues and the answer", () => {
  const p = run([1, 2, 3, 4, 5].map((n) => rec(n)));
  assert.equal(p.state, "exhausted"); assert.equal(p.answer, "the answer"); assert.equal(p.clues.length, 5); assert.equal(p.score_awarded, 0);
});
