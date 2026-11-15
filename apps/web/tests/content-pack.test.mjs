// Content pack validation for curated Threadly puzzles (docs/14-content-guidelines.md,
// docs/05-game-rules.md). Runs with: node --test apps/web/tests/content-pack.test.mjs
//
// The similarity functions below mirror services/answerService.ts exactly; parity
// vectors pin them to the documented matcher behavior. Keep both in sync if the
// matcher ever changes - the content pack must always be checked against the real
// matching semantics.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pack = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../content/puzzles.v1.json"), "utf8"),
);

// --- mirror of services/answerService.ts (normalizeString / editDistance / getSimilarity / checkAnswer) ---
function normalizeString(str) {
  return str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim().replace(/s$/, "");
}
function editDistance(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  const row = new Int32Array(s2.length + 1);
  for (let j = 0; j <= s2.length; j++) row[j] = j;
  for (let i = 1; i <= s1.length; i++) {
    let prevDiagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const temp = row[j];
      const cost = s1.charCodeAt(i - 1) === s2.charCodeAt(j - 1) ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prevDiagonal + cost);
      prevDiagonal = temp;
    }
  }
  return row[s2.length];
}
function getSimilarity(s1, s2) {
  let longer = s1, shorter = s2;
  if (s1.length < s2.length) [longer, shorter] = [s2, s1];
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}
function checkAnswer(guess, answer) {
  const g = normalizeString(guess), a = normalizeString(answer);
  const similarity = getSimilarity(g, a);
  return { isCorrect: similarity >= 0.85 || (a.includes(g) && g.length > 5), similarity };
}
// --- end mirror ---

// Starter denylist per docs/14: no political, religious or offensive content.
// Word-boundary matched to avoid false positives (e.g. "skill").
const DENIED = [
  "politics", "political", "election", "president", "senator", "democrat", "republican",
  "god", "jesus", "allah", "bible", "quran", "church", "mosque", "prayer", "worship",
  "nazi", "hitler", "genocide", "terrorist", "terrorism",
  "porn", "cocaine", "heroin", "murder", "suicide", "rape",
];
const deniedPattern = new RegExp(`\\b(${DENIED.join("|")})\\b`, "i");

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

test("matcher mirror parity with documented examples", () => {
  // docs/05 example: "Programming Languages" matches "programming language"
  assert.equal(checkAnswer("programming language", "Programming Languages").isCorrect, true);
  assert.equal(normalizeString("Programming Languages"), "programming language");
  assert.equal(checkAnswer("echo", "ECHO").isCorrect, true);
  assert.equal(checkAnswer("completely wrong answer", "ECHO").isCorrect, false);
});

test("pack shape and global uniqueness", () => {
  assert.ok(Array.isArray(pack.puzzles), "puzzles array");
  assert.ok(pack.puzzles.length >= 30, "at least a month of daily content");
  const ids = new Set(), answers = new Set();
  for (const p of pack.puzzles) {
    assert.match(p.id, /^v1-\d{3}$/, `id shape: ${p.id}`);
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    const norm = normalizeString(p.answer);
    assert.ok(!answers.has(norm), `duplicate answer ${p.answer}`);
    answers.add(norm);
  }
});

for (const p of pack.puzzles) {
  test(`${p.id} (${p.answer}) follows content and matcher rules`, () => {
    assert.match(p.answer, /^[A-Za-z][A-Za-z' -]{1,38}[A-Za-z]$/, "answer characters and length");
    assert.ok(DIFFICULTIES.has(p.difficulty), "difficulty enum");
    assert.equal(typeof p.category, "string");
    assert.ok(p.category.length >= 3, "category present");

    assert.equal(p.clues.length, 5, "exactly five clues");
    const seen = new Set();
    p.clues.forEach((clue, i) => {
      assert.equal(typeof clue, "string");
      assert.ok(clue.length >= 8 && clue.length <= 160, `clue ${i + 1} length`);
      const norm = clue.toLowerCase();
      assert.ok(!seen.has(norm), `clue ${i + 1} duplicate`);
      seen.add(norm);
      // Spoiler rule: the answer must never appear in any clue, in either
      // raw or normalized form ("almost revealing" is not "revealing").
      assert.ok(!norm.includes(p.answer.toLowerCase()), `clue ${i + 1} contains the raw answer`);
      assert.ok(!normalizeString(clue).includes(normalizeString(p.answer)), `clue ${i + 1} contains the normalized answer`);
      assert.ok(!deniedPattern.test(clue), `clue ${i + 1} restricted content`);
    });

    assert.ok(!deniedPattern.test(p.answer), "answer restricted content");
    assert.ok(!deniedPattern.test(p.category), "category restricted content");

    // Matcher compatibility: exact answer always matches; the trailing-s plural
    // variant of a non-plural answer must also match (normalization contract).
    assert.equal(checkAnswer(p.answer, p.answer).isCorrect, true, "exact answer");
    if (!p.answer.toLowerCase().endsWith("s")) {
      assert.equal(checkAnswer(p.answer + "s", p.answer).isCorrect, true, "plural variant");
    }
    // Mixed case and surrounding punctuation must not break matching.
    assert.equal(checkAnswer(` ${p.answer.toUpperCase()}! `, p.answer).isCorrect, true, "case and punctuation");
  });
}
