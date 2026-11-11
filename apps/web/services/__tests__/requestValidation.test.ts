import { test } from "node:test";
import assert from "node:assert/strict";
import { validGuess, validPuzzleId, validGuestId } from "../requestValidation.ts";
test("guess matcher receives only nonempty strings of at most 200 characters", () => {
  for (const bad of [null, undefined, 1, true, {}, [], "", "   ", "x".repeat(201), "x".repeat(100000)]) assert.equal(validGuess(bad), false);
  assert.equal(validGuess(" x "), true); assert.equal(validGuess("x".repeat(200)), true);
});
test("puzzle and guest identifiers are type and length bounded", () => {
  for (const bad of [null, 1, {}, "", " ", "x".repeat(101)]) assert.equal(validPuzzleId(bad), false);
  for (const bad of [null, 1, {}, "", "1234567", "        ", "x".repeat(101)]) assert.equal(validGuestId(bad), false);
  assert.equal(validPuzzleId("puzzle"), true); assert.equal(validGuestId("guest123"), true);
});
