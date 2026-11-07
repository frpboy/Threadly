import { test } from "node:test";
import assert from "node:assert/strict";
import { progressToUiState, shouldResync } from "../../lib/progressUi.ts";

const clues = [{ order: 1, text: "a" }, { order: 2, text: "b" }, { order: 3, text: "c" }];

test("open game resumes at the server's clue with earlier guesses, no answer", () => {
  const u = progressToUiState({ state: "open", clue_number: 3, clues, guesses: ["x", "y"], total_clues: 5, score_awarded: 0 });
  assert.equal(u.cluesRevealed, 3); assert.equal(u.isGameOver, false); assert.equal(u.correctAnswer, ""); assert.deepEqual(u.guesses, ["x", "y"]);
});

test("solved game: game over, correct, score and answer, last (correct) guess not listed as a miss", () => {
  const u = progressToUiState({ state: "solved", clue_number: 3, clues, guesses: ["x", "y", "right"], total_clues: 5, score_awarded: 60, answer: "right" });
  assert.equal(u.isGameOver, true); assert.equal(u.isCorrect, true); assert.equal(u.score, 60); assert.equal(u.correctAnswer, "right"); assert.deepEqual(u.guesses, ["x", "y"]);
});

test("exhausted game: game over, not correct, answer shown", () => {
  const u = progressToUiState({ state: "exhausted", clue_number: 5, clues, guesses: ["1", "2", "3", "4", "5"], total_clues: 5, score_awarded: 0, answer: "ans" });
  assert.equal(u.isGameOver, true); assert.equal(u.isCorrect, false); assert.equal(u.correctAnswer, "ans");
});

test("409 means resync from the server; other statuses do not", () => {
  assert.equal(shouldResync(409), true); assert.equal(shouldResync(200), false); assert.equal(shouldResync(500), false);
});
