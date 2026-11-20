import { boundedJson } from "@/services/nativeBeta/body";
import { betaTransaction, validRequestId, RequestConflict } from "@/services/nativeBeta/guessRequest";
import { betaEnabled, nativePrincipal, authorizationPresent } from "@/services/nativeBeta/access";
import { validPuzzleContent } from "@/services/puzzleContract";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { checkAnswer } from "@/services/answerService";
import { calculateScore } from "@/services/scoringService";
import { recalculatePuzzleDifficulty } from "@/services/difficultyService";
import { MAX_CLUES } from "@/services/attemptService";
import { submitGuess } from "@/services/guessTransaction";
import { runInPrismaTransaction } from "@/services/prismaAttemptStore";
import { validPuzzleId, validGuess, validGuestId, claimableGuestId } from "@/services/requestValidation";
import { captureHandledApiError } from "@/services/apiErrorCapture";
import { publicationDayReached } from "@/services/puzzleService";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(req: NextRequest) {
  try {
    const beta = betaEnabled();
    // A presented-but-invalid device credential is always rejected; an absent one only in the legacy isolated-beta gate.
    const device = await nativePrincipal(req);
    if (!device && (beta || authorizationPresent(req))) return privateJson({ error: "Unauthorized" }, { status: 401 });
    // clues_revealed from the client is ignored: the server derives it from its own guess log.
    let body: unknown;
    try {
      body = beta ? await boundedJson(req) : await req.json();
    } catch {
      return privateJson({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const { puzzle_id, guess, guest_id: claimedGuestId, request_id } = body as Record<string, unknown>;
    const guest_id = device?.guestId ?? claimedGuestId;
    // Any credentialed device (legacy beta or open) records an idempotency receipt keyed by request_id.
    if (device && !validRequestId(request_id)) return privateJson({ error: "A request_id UUID is required" }, { status: 400 });

    if (!validPuzzleId(puzzle_id) || !validGuess(guess)) {
      return privateJson(
        { error: "A valid puzzle_id and a nonempty guess of at most 200 characters are required" },
        { status: 400 }
      );
    }

    const puzzle = await db.puzzle.findUnique({
      where: { id: puzzle_id }, include: { clues: true }
    });

    if (!puzzle || puzzle.status !== "published" || !publicationDayReached(puzzle, new Date()) || !validPuzzleContent(puzzle)) {
      return privateJson({ error: "Puzzle not found" }, { status: 404 });
    }

    // Get current session for logged in user. A credentialed device request never
    // consults the browser session: one request, one unambiguous owner.
    const session = (beta || device) ? null : await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    // A credentialed device uses its server-issued identity; a guest may only claim
    // a guest-namespace id (never a server-issued dev-*/beta-* one).
    if (!userId && !(device ? validGuestId(device.guestId) : claimableGuestId(claimedGuestId))) {
      return privateJson({ error: "guest_id is required for guests" }, { status: 400 });
    }
    // Device identity takes precedence over any account session, and matches the
    // identity the idempotency receipt is recorded under.
    const playerKey = device ? `g:${device.guestId}` : userId ? `u:${userId}` : `g:${guest_id}`;

    const { isCorrect, similarity } = checkAnswer(guess.trim(), puzzle.answer);

    const { outcome, award } = await submitGuess(device ? betaTransaction(device.guestId, request_id as string, puzzle.id, guess.trim()) : runInPrismaTransaction, {
      puzzleId: puzzle.id,
      playerKey,
      guessText: guess.trim(),
      isCorrect,
      scoreFor: calculateScore,
    });

    if (outcome.status === "replay") {
      return privateJson({ error: "Duplicate or concurrent guess" }, { status: 409 });
    }
    if (outcome.status === "already_solved") {
      return privateJson({
        correct: true, already_solved: true, clues_used: outcome.cluesUsed,
        score_awarded: 0, answer: puzzle.answer, message: "Already solved"
      }, { status: 409 });
    }
    if (outcome.status === "exhausted") {
      return privateJson({
        correct: false, exhausted: true, answer: puzzle.answer, message: "No guesses left"
      }, { status: 409 });
    }

    const clues_revealed = outcome.cluesUsed;
    const scoreAwarded = outcome.scoreAwarded;
    const { streak: streakInfo, stats: statsInfo } = (award ?? {}) as {
      streak?: { currentStreak: number }; stats?: unknown;
    };

    // Run dynamic difficulty assessment asynchronously in background
    if (!beta) recalculatePuzzleDifficulty(puzzle.id).catch(err => {
      console.error("Difficulty engine failed");
    });

    const showAnswer = isCorrect || clues_revealed >= MAX_CLUES;

    return privateJson({
      correct: isCorrect,
      similarity_score: parseFloat(similarity.toFixed(2)),
      clues_used: clues_revealed,
      score_awarded: scoreAwarded,
      answer: showAnswer ? puzzle.answer : undefined,
      streak: streakInfo?.currentStreak ?? 0,
      stats: statsInfo,
      message: isCorrect ? "Correct!" : "Incorrect answer"
    });
  } catch (error: unknown) {
    if (error instanceof RequestConflict) return privateJson({ error: "Request ID conflict" }, { status: 409 });
    console.error("Failed to process guess");
    captureHandledApiError("guess", error);
    return privateJson(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
