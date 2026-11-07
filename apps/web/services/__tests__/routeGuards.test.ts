import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as validation from "../requestValidation.ts";
const require = createRequire(import.meta.url);
/** Execute the actual route source, transpiled without rewriting its logic; external services are fakes. */
function route(name: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../../app/api/${name}/route.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", js)((id: string) => {
    if (id in mocks) return mocks[id];
    if (id === "next/server") return require(id);
    throw new Error(`Unexpected route dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
function guessRoute(published = true) {
  const calls = { puzzle: 0, matcher: 0, submit: 0 };
  const post = route("guess", {
    "@/lib/db": { db: { puzzle: { findUnique: async () => { calls.puzzle++; return { id: "p", answer: "answer", status: published ? "published" : "draft" }; } } } },
    "@/auth": { auth: async () => null },
    "@/services/answerService": { checkAnswer: () => { calls.matcher++; return { isCorrect: true, similarity: 1 }; } },
    "@/services/scoringService": { calculateScore: () => 100 },
    "@/services/difficultyService": { recalculatePuzzleDifficulty: async () => {} },
    "@/services/attemptService": { MAX_CLUES: 5 },
    "@/services/guessTransaction": { submitGuess: async () => { calls.submit++; return { outcome: { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 } }; } },
    "@/services/prismaAttemptStore": { runInPrismaTransaction: () => { throw new Error("not expected"); } },
    "@/services/requestValidation": validation,
  }).POST;
  return { calls, post, send: (body: unknown) => post(new Request("http://localhost/api/guess", { method: "POST", body: JSON.stringify(body) })) };
}
test("actual guess route rejects invalid input before database or edit-distance work", async () => {
  const f = guessRoute();
  for (const guess of [null, 42, {}, "", " ", "x".repeat(201)]) {
    assert.equal((await f.send({ puzzle_id: "p", guess, guest_id: "guest123" })).status, 400);
  }
  assert.deepEqual(f.calls, { puzzle: 0, matcher: 0, submit: 0 });
});
test("actual guess route rejects an unpublished puzzle without matching or awarding", async () => {
  const f = guessRoute(false);
  assert.equal((await f.send({ puzzle_id: "p", guess: "answer", guest_id: "guest123" })).status, 404);
  assert.deepEqual(f.calls, { puzzle: 1, matcher: 0, submit: 0 });
});
test("actual guess route still accepts a valid published puzzle and does not accept client score", async () => {
  const f = guessRoute();
  const r = await f.send({ puzzle_id: "p", guess: "answer", guest_id: "guest123", clues_revealed: 0, score: 999999 });
  assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.equal((await r.json()).score_awarded, 100);
  assert.deepEqual(f.calls, { puzzle: 1, matcher: 1, submit: 1 });
});
test("actual leaderboard POST refuses arbitrary points and cannot touch database", async () => {
  const f = route("leaderboard", { "@/lib/db": { db: new Proxy({}, { get() { throw new Error("database touched"); } }) } });
  const r = await f.POST(new Request("http://localhost/api/leaderboard", { method: "POST", body: JSON.stringify({ score: 1000000, guest_id: "guest123" }) }));
  assert.equal(r.status, 405); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.equal(r.headers.get("Allow"), "GET");
});
test("leaderboard GET with no active season does not create one", async () => {
  const f = route("leaderboard", { "@/lib/db": { db: { leaderboardSeason: { findFirst: async () => null, create: () => { throw new Error("create forbidden"); } } } } });
  const r = await f.GET(); assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.deepEqual((await r.json()).entries, []);
});
test("actual guess route returns private400 for malformed JSON and non-object JSON", async () => {
  const f = guessRoute();
  // send() serializes JSON; unsupported top-level JSON must not reach DB or matcher.
  for (const body of [null, [], 42, "guess"]) assert.equal((await f.send(body)).status, 400);
  const bad = await f.post(new Request("http://localhost/api/guess", { method: "POST", body: "{" }));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(f.calls, { puzzle: 0, matcher: 0, submit: 0 });
});
