import assert from "node:assert/strict";
import test from "node:test";
import { createProgressSnapshot } from "../services/progressService.ts";

const clues = [
  { clueOrder: 1, clueText: "Clue one" },
  { clueOrder: 2, clueText: "Clue two" },
  { clueOrder: 3, clueText: "Clue three" },
  { clueOrder: 4, clueText: "Clue four" },
  { clueOrder: 5, clueText: "Clue five" }
];

test("new guest receives only clue one and no answer", () => {
  const result = createProgressSnapshot(clues, [], "secret answer");
  assert.equal(result.state, "open");
  assert.equal(result.clue_number, 1);
  assert.deepEqual(result.clues, [{ order: 1, text: "Clue one" }]);
  assert.deepEqual(result.guesses, []);
  assert.equal("answer" in result, false);
});

test("open game resumes from persisted wrong guesses", () => {
  const result = createProgressSnapshot(clues, [
    { guessText: "wrong one", isCorrect: false },
    { guessText: "wrong two", isCorrect: false }
  ], "secret answer");
  assert.equal(result.state, "open");
  assert.equal(result.clue_number, 3);
  assert.equal(result.clues.length, 3);
  assert.deepEqual(result.guesses, ["wrong one", "wrong two"]);
  assert.equal("answer" in result, false);
});

test("solved game reveals answer and scores using the winning attempt", () => {
  const result = createProgressSnapshot(clues, [
    { guessText: "wrong", isCorrect: false },
    { guessText: "correct", isCorrect: true },
    { guessText: "later attempt", isCorrect: false }
  ], "secret answer");
  assert.equal(result.state, "solved");
  assert.equal(result.clue_number, 2);
  assert.equal(result.score_awarded, 80);
  assert.equal(result.answer, "secret answer");
  assert.deepEqual(result.guesses, ["wrong", "correct"]);
});

test("exhausted game reveals answer after the final clue", () => {
  const result = createProgressSnapshot(clues, [
    { guessText: "a", isCorrect: false },
    { guessText: "b", isCorrect: false },
    { guessText: "c", isCorrect: false },
    { guessText: "d", isCorrect: false },
    { guessText: "e", isCorrect: false }
  ], "secret answer");
  assert.equal(result.state, "exhausted");
  assert.equal(result.clue_number, 5);
  assert.equal(result.score_awarded, 0);
  assert.equal(result.answer, "secret answer");
  assert.equal(result.clues.length, 5);
});
