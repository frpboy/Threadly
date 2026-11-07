import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkAnswer } from "@/services/answerService";
import { calculateScore } from "@/services/scoringService";
import { updatePlayerStreak } from "@/services/streakService";
import { updatePlayerStats } from "@/services/statsService";
import { recalculatePuzzleDifficulty } from "@/services/difficultyService";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const puzzleId = payload.puzzle_id;
    const guess = payload.guess;
    const guestId = payload.guest_id;

    if (typeof puzzleId !== "string" || !puzzleId.trim() ||
        typeof guess !== "string" || !guess.trim() || guess.length > 200 ||
        (guestId !== undefined && guestId !== null &&
          (typeof guestId !== "string" || guestId.length > 128))) {
      return NextResponse.json(
        { error: "puzzle_id and a valid guess are required" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    if (!userId && !guestId) {
      return NextResponse.json(
        { error: "Authentication or guest_id is required" },
        { status: 401 }
      );
    }

    const puzzle = await db.puzzle.findUnique({
      where: { id: puzzleId },
      include: {
        clues: {
          select: { clueOrder: true },
          orderBy: { clueOrder: "asc" }
        }
      }
    });

    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const totalClues = puzzle.clues.length;
    if (totalClues === 0) {
      return NextResponse.json({ error: "Puzzle has no clues" }, { status: 409 });
    }

    const identityKey = userId ? `user:${userId}` : `guest:${guestId}`;
    const playerFilter = userId ? { userId } : { guestId };

    // PostgreSQL transaction-scoped advisory lock serializes guesses for this
    // player + puzzle. The read, validation, insert and completion side effects
    // share the same transaction, so retries/double-clicks cannot finish twice.
    const attempt = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${identityKey}), hashtext(${puzzle.id}))`;

      const priorGuesses = await tx.guess.findMany({
        where: { puzzleId: puzzle.id, ...playerFilter },
        select: { isCorrect: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });

      if (priorGuesses.some((entry) => entry.isCorrect)) {
        return { kind: "blocked" as const, state: "solved" as const };
      }
      if (priorGuesses.length >= totalClues) {
        return { kind: "blocked" as const, state: "exhausted" as const };
      }

      // Never accept a client-provided clue counter for score or answer reveal.
      const clueNumber = Math.min(priorGuesses.length + 1, totalClues);
      const normalizedGuess = guess.trim();
      const { isCorrect, similarity } = checkAnswer(normalizedGuess, puzzle.answer);
      const scoreAwarded = isCorrect ? calculateScore(clueNumber) : 0;

      await tx.guess.create({
        data: {
          userId,
          guestId: userId ? null : guestId,
          puzzleId: puzzle.id,
          guessText: normalizedGuess,
          isCorrect,
          clueNumber
        }
      });

      const gameFinished = isCorrect || clueNumber >= totalClues;
      let streakInfo = null;
      let statsInfo = null;

      if (gameFinished) {
        // Keep all completion effects under the same lock and transaction.
        streakInfo = await updatePlayerStreak(
          userId, userId ? null : guestId, isCorrect, tx
        );
        statsInfo = await updatePlayerStats(
          userId, userId ? null : guestId, isCorrect, clueNumber, tx
        );
      }

      return {
        kind: "created" as const,
        clueNumber,
        isCorrect,
        similarity,
        scoreAwarded,
        gameFinished,
        streak: streakInfo?.currentStreak ?? 0,
        stats: statsInfo
      };
    }, { maxWait: 5_000, timeout: 15_000 });

    if (attempt.kind === "blocked") {
      return NextResponse.json(
        { error: attempt.state === "solved" ? "GAME_ALREADY_FINISHED" : "GAME_EXHAUSTED" },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (attempt.isCorrect && attempt.scoreAwarded > 0) {
            if (isCorrect && scoreAwarded > 0) {
              try {
                const today = new Date();
                let season = await db.leaderboardSeason.findFirst({
                  where: {
                    startDate: { lte: today },
                    endDate: { gte: today }
                  }
                });
                if (!season) {
                  const endDate = new Date();
                  endDate.setDate(endDate.getDate() + 30);
                  season = await db.leaderboardSeason.create({
                    data: {
                      name: `Season ${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}`,
                      startDate: today,
                      endDate
                    }
                  });
                }
      
                const userFilter = userId ? { userId } : { guestId };
                const existingEntry = await db.leaderboardEntry.findFirst({
                  where: { seasonId: season.id, ...userFilter }
                });
      
                if (existingEntry) {
                  await db.leaderboardEntry.update({
                    where: { id: existingEntry.id },
                    data: { score: existingEntry.score + scoreAwarded }
                  });
                } else {
                  const data = {
                    seasonId: season.id,
                    score: scoreAwarded,
                    updatedAt: new Date(),
                    ...(userId ? { userId } : { guestId })
                  };
                  await db.leaderboardEntry.create({ data });
                }
              } catch (leaderboardErr) {
                // Leaderboard is ancillary; keep the accepted guess and game result.
                console.error("Failed to update leaderboard score:", {
                  name: leaderboardErr instanceof Error ? leaderboardErr.name : "UnknownError"
                });
              }
            }
    }

    recalculatePuzzleDifficulty(puzzle.id).catch((error) => {
      console.error("Difficulty engine failed:", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    });

    const showAnswer = attempt.isCorrect || attempt.clueNumber >= totalClues;
    return NextResponse.json({
      correct: attempt.isCorrect,
      similarity_score: Number(attempt.similarity.toFixed(2)),
      clues_used: attempt.clueNumber,
      score_awarded: attempt.scoreAwarded,
      answer: showAnswer ? puzzle.answer : undefined,
      streak: attempt.streak,
      stats: attempt.stats,
      message: attempt.isCorrect ? "Correct!" : "Incorrect answer"
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Failed to process guess:", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
