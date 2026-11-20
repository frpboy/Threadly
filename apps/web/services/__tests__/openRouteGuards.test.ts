import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as validation from "../requestValidation.ts";
import { validPuzzleContent } from "../puzzleContract.ts";
import { buildProgress } from "../progressService.ts";
import { boundedJson } from "../nativeBeta/body.ts";
const require = createRequire(import.meta.url);

const TODAY = new Date(); TODAY.setUTCHours(0, 0, 0, 0);
const fiveClues = () => Array.from({ length: 5 }, (_, i) => ({ clueOrder: i + 1, clueText: "clue" + (i + 1) }));
const publishedPuzzle = { id: "p", answer: "answer", status: "published", publishedDate: TODAY, clues: fiveClues() };
const DEVICE = { guestId: "dev-0123456789abcdef0123456789abcdef0123456789abcdef", open: true, expiresAt: Date.now() + 86400000 };

/** Execute the actual route source, transpiled without rewriting its logic; external services are fakes. */
function route(name: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../../app/api/${name}/route.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "@/services/puzzleContract") return { validPuzzleContent };
    if (id === "@/services/nativeBeta/body") return { boundedJson }; // the REAL bounded reader, never faked
    if (id in mocks) return mocks[id];
    if (id === "next/server") return require(id);
    throw new Error(`Unexpected route dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}

/** Real header semantics: a principal only for the exact valid token; presence from the raw header. */
function accessMock(validToken = "VALID-TOKEN") {
  return {
    "@/services/nativeBeta/access": {
      betaEnabled: () => false,
      openNativeEnabled: () => true,
      nativePrincipal: async (req: Request) =>
        req.headers.get("authorization") === `Bearer ${validToken}` ? DEVICE : null,
      authorizationPresent: (req: Request) => {
        const h = req.headers.get("authorization");
        return typeof h === "string" && h.trim().length > 0;
      },
    },
  };
}

function progressMocks(extra: Record<string, unknown> = {}, session: unknown = null) {
  const seen = { playerKey: null as string | null, authCalls: 0 };
  const post = route("progress", {
    ...accessMock(),
    "@/services/apiErrorCapture": { captureHandledApiError: () => {} },
    "@/lib/db": { db: { puzzle: { findUnique: async () => publishedPuzzle } } },
    "@/auth": { auth: async () => { seen.authCalls++; return session; } },
    "@/services/scoringService": { calculateScore: () => 100 },
    "@/services/progressService.ts": { buildProgress },
    "@/services/prismaAttemptStore": { prismaHistory: () => async (_p: string, playerKey: string) => { seen.playerKey = playerKey; return []; } },
    "@/services/requestValidation": validation,
    ...extra,
  }).POST;
  const send = (body: unknown, auth?: string) => post(new Request("http://localhost/api/progress", {
    method: "POST", body: JSON.stringify(body),
    ...(auth ? { headers: { authorization: auth } } : {}),
  }));
  return { seen, send };
}

test("progress: a server-issued dev-* id is never claimable through the guest path", async () => {
  const f = progressMocks();
  for (const id of [DEVICE.guestId, "dev-anything", "beta-legacy1", "DEV-uppercase"]) {
    assert.equal((await f.send({ puzzle_id: "p", guest_id: id })).status, 400, id);
  }
  assert.equal(f.seen.playerKey, null);
});

test("progress: malformed Authorization is a 401, never a guest fallback", async () => {
  const f = progressMocks();
  const r = await f.send({ puzzle_id: "p", guest_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }, "Bearer !!not-a-token!!");
  assert.equal(r.status, 401);
  assert.equal(f.seen.playerKey, null);
});

test("progress: a valid device credential owns the request even with an account session", async () => {
  const f = progressMocks({}, { user: { id: "user-1" } });
  const r = await f.send({ puzzle_id: "p", guest_id: "ignored-claimed-id" }, "Bearer VALID-TOKEN");
  assert.equal(r.status, 200);
  assert.equal(f.seen.playerKey, `g:${DEVICE.guestId}`);
  assert.equal(f.seen.authCalls, 0, "device requests never consult the browser session");
});

test("daily: malformed Authorization is a 401", async () => {
  const f = route("daily", {
    ...accessMock(),
    "@/services/apiErrorCapture": { captureHandledApiError: () => {} },
    "@/services/puzzleService": { getDailyPuzzle: async () => publishedPuzzle, publicationDayReached: () => true },
  });
  const r = await f.GET(new Request("http://localhost/api/daily", { headers: { authorization: "Bearer broken" } }));
  assert.equal(r.status, 401);
});

function guessMocks(session: unknown = null) {
  const seen = { playerKey: null as string | null, receiptGuest: null as string | null, authCalls: 0 };
  const post = route("guess", {
    ...accessMock(),
    "@/services/nativeBeta/guessRequest": {
      betaTransaction: (guestId: string) => { seen.receiptGuest = guestId; return async () => { throw new Error("tx body must not run in mock"); }; },
      validRequestId: (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v),
      RequestConflict: class RequestConflict extends Error {},
    },
    "@/services/apiErrorCapture": { captureHandledApiError: () => {} },
    "@/services/puzzleService": { publicationDayReached: () => true },
    "@/lib/db": { db: { puzzle: { findUnique: async () => publishedPuzzle } } },
    "@/auth": { auth: async () => { seen.authCalls++; return session; } },
    "@/services/answerService": { checkAnswer: () => ({ isCorrect: true, similarity: 1 }) },
    "@/services/scoringService": { calculateScore: () => 100 },
    "@/services/difficultyService": { recalculatePuzzleDifficulty: async () => {} },
    "@/services/attemptService": { MAX_CLUES: 5 },
    "@/services/guessTransaction": {
      submitGuess: async (_tx: unknown, args: { playerKey: string }) => {
        seen.playerKey = args.playerKey;
        return { outcome: { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 } };
      },
    },
    "@/services/prismaAttemptStore": { runInPrismaTransaction: () => { throw new Error("not expected"); } },
    "@/services/requestValidation": validation,
  }).POST;
  const send = (body: unknown, auth?: string) => post(new Request("http://localhost/api/guess", {
    method: "POST", body: JSON.stringify(body),
    ...(auth ? { headers: { authorization: auth } } : {}),
  }));
  return { seen, send };
}

test("guess: a credentialed device requires a request_id for its idempotency receipt", async () => {
  const f = guessMocks();
  const r = await f.send({ puzzle_id: "p", guess: "answer", guest_id: "x" }, "Bearer VALID-TOKEN");
  assert.equal(r.status, 400);
  assert.equal(f.seen.playerKey, null);
});

test("guess: device identity owns playerKey and receipt even with an account session", async () => {
  const f = guessMocks({ user: { id: "user-1" } });
  const r = await f.send({ puzzle_id: "p", guess: "answer", guest_id: "ignored", request_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }, "Bearer VALID-TOKEN");
  assert.equal(r.status, 200);
  assert.equal(f.seen.playerKey, `g:${DEVICE.guestId}`);
  assert.equal(f.seen.receiptGuest, DEVICE.guestId);
  assert.equal(f.seen.authCalls, 0);
});

test("guess: a server-issued dev-* id is never claimable through the guest path", async () => {
  const f = guessMocks();
  const r = await f.send({ puzzle_id: "p", guess: "answer", guest_id: DEVICE.guestId });
  assert.equal(r.status, 400);
  assert.equal(f.seen.playerKey, null);
});

/** Guess route wired for the post-deletion race: the runner (betaTransaction) may throw CredentialRevoked. */
function raceGuessMocks(deleted: boolean) {
  const seen = { opts: undefined as unknown, uowRan: false, authCalls: 0 };
  class CredentialRevoked extends Error {}
  const post = route("guess", {
    ...accessMock(),
    "@/services/nativeBeta/guessRequest": {
      betaTransaction: (_g: string, _r: string, _p: string, _guess: string, opts: unknown) => {
        seen.opts = opts;
        return async (fn: (uow: unknown) => Promise<unknown>) => {
          if (deleted) throw new CredentialRevoked("identity deleted before this transaction took the lock");
          seen.uowRan = true;
          return fn({});
        };
      },
      validRequestId: (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v),
      RequestConflict: class RequestConflict extends Error {},
      CredentialRevoked,
    },
    "@/services/apiErrorCapture": { captureHandledApiError: () => {} },
    "@/services/puzzleService": { publicationDayReached: () => true },
    "@/lib/db": { db: { puzzle: { findUnique: async () => publishedPuzzle } } },
    "@/auth": { auth: async () => { seen.authCalls++; return null; } },
    "@/services/answerService": { checkAnswer: () => ({ isCorrect: true, similarity: 1 }) },
    "@/services/scoringService": { calculateScore: () => 100 },
    "@/services/difficultyService": { recalculatePuzzleDifficulty: async () => {} },
    "@/services/attemptService": { MAX_CLUES: 5 },
    "@/services/guessTransaction": {
      submitGuess: async (tx: (fn: (uow: unknown) => Promise<unknown>) => Promise<unknown>, _args: unknown) =>
        tx(async () => ({ outcome: { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 }, award: {} })),
    },
    "@/services/prismaAttemptStore": { runInPrismaTransaction: () => { throw new Error("not expected"); } },
    "@/services/requestValidation": validation,
  }).POST;
  const send = () => post(new Request("http://localhost/api/guess", {
    method: "POST",
    body: JSON.stringify({ puzzle_id: "p", guess: "answer", guest_id: "x", request_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }),
    headers: { authorization: "Bearer VALID-TOKEN" },
  }));
  return { seen, send };
}

test("guess: an open device asks for in-transaction re-verification (race gate wiring)", async () => {
  const f = raceGuessMocks(false);
  const r = await f.send();
  assert.equal(r.status, 200);
  assert.deepEqual(f.seen.opts, { openDevice: true });
  assert.equal(f.seen.uowRan, true);
});

test("guess: identity deleted after authentication -> the locked transaction aborts 401, no writes run", async () => {
  const f = raceGuessMocks(true);
  const r = await f.send();
  assert.equal(r.status, 401);
  assert.equal(f.seen.uowRan, false);
  assert.equal((await r.json() as { error: string }).error, "Unauthorized");
});

function deleteMocks(over: Record<string, unknown> = {}) {
  const seen = { deleted: [] as Array<{ guestId: string; header: string | null | undefined }> };
  const del = route("player-data", {
    ...accessMock(),
    "@/services/nativeBeta/store": {
      openDeviceStore: {
        findOpenDeviceForDeletion: async (header: string) =>
          header === "Bearer CAPPED-OR-EXPIRED" ? "dev-cappedplayer" + "0".repeat(36) : null,
      },
      deleteIdentityData: async (guestId: string, header: string | null | undefined) => {
        seen.deleted.push({ guestId, header });
        return { counts: { guesses: 1, streaks: 1, stats: 1, leaderboard: 0, receipts: 2 }, deviceRemoved: true };
      },
    },
    "@/services/requestValidation": validation,
    "@/services/apiErrorCapture": { captureHandledApiError: () => {} },
    ...over,
  }).DELETE;
  const send = (body?: unknown, auth?: string) => del(new Request("http://localhost/api/player-data", {
    method: "DELETE",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(auth ? { headers: { authorization: auth } } : {}),
  }));
  return { seen, send };
}

test("player-data: guest deletion of a server-issued dev-* id is refused", async () => {
  const f = deleteMocks();
  const r = await f.send({ guest_id: DEVICE.guestId, confirm: true });
  assert.equal(r.status, 400);
  assert.equal(f.seen.deleted.length, 0);
});

test("player-data: web guest deletion works with a claimable id and confirm:true", async () => {
  const f = deleteMocks();
  const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const r = await f.send({ guest_id: id, confirm: true });
  assert.equal(r.status, 200);
  assert.equal(f.seen.deleted.length, 1);
  assert.equal(f.seen.deleted[0].guestId, id);
  assert.equal(f.seen.deleted[0].header, undefined);
  assert.equal((await r.json()).counts.receipts, 2);
});

test("player-data: valid open credential deletes its identity and revokes atomically", async () => {
  const f = deleteMocks();
  const r = await f.send(undefined, "Bearer VALID-TOKEN");
  assert.equal(r.status, 200);
  assert.deepEqual(f.seen.deleted, [{ guestId: DEVICE.guestId, header: "Bearer VALID-TOKEN" }]);
  assert.equal((await r.json()).deviceRemoved, true);
});

test("player-data: a capped or expired credential can still self-delete", async () => {
  const f = deleteMocks();
  const r = await f.send(undefined, "Bearer CAPPED-OR-EXPIRED");
  assert.equal(r.status, 200);
  assert.equal(f.seen.deleted.length, 1);
});

test("player-data: unknown or malformed credentials are 401 and never reach the guest path", async () => {
  const f = deleteMocks();
  assert.equal((await f.send(undefined, "Bearer NOPE")).status, 401);
  assert.equal((await f.send(undefined, "garbage-header")).status, 401);
  assert.equal(f.seen.deleted.length, 0);
});

test("player-data: a failed deletion transaction surfaces 503 and revokes nothing", async () => {
  const f = deleteMocks({
    "@/services/nativeBeta/store": {
      openDeviceStore: { findOpenDeviceForDeletion: async () => null },
      deleteIdentityData: async () => { throw new Error("induced SQL failure"); },
    },
  });
  const r = await f.send(undefined, "Bearer VALID-TOKEN");
  assert.equal(r.status, 503);
});
