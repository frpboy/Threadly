import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { checkAnswer } from "@/services/answerService";
import { calculateScore } from "@/services/scoringService";
import { updatePlayerStreak } from "@/services/streakService";
import { updatePlayerStats } from "@/services/statsService";
import { recalculatePuzzleDifficulty } from "@/services/difficultyService";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const puzzleId = payload?.puzzle_id;
    const guess = payload?.guess;
    const guestId = payload?.guest_id;

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
    const userId = (session?.user as any)?.id || null;
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

    const playerFilter = userId ? { userId } : { guestId };
    const priorGuesses = await db.guess.findMany({
      where: { puzzleId: puzzle.id, ...playerFilter },
      select: { isCorrect: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    if (priorGuesses.some((entry) => entry.isCorrect)) {
      return NextResponse.json(
        { error: "GAME_ALREADY_FINISHED" },
        { status: 409 }
      );
    }
    if (priorGuesses.length >= totalClues) {
      return NextResponse.json(
        { error: "GAME_EXHAUSTED" },
        { status: 409 }
      );
    }

    // The server derives the active clue from persisted attempts. Never trust
    // a client-provided clues_revealed value for score or answer disclosure.
    const clueNumber = Math.min(priorGuesses.length + 1, totalClues);
    const normalizedGuess = guess.trim();
    const { isCorrect, similarity } = checkAnswer(normalizedGuess, puzzle.answer);
    const scoreAwarded = isCorrect ? calculateScore(clueNumber) : 0;

    await db.guess.create({
      data: {
        userId,
        guestId: userId ? null : guestId,
        puzzleId: puzzle.id,
        guessText: normalizedGuess,
        isCorrect,
        clueNumber
      }
    });

    // Count a completed game once, rather than incrementing gamesPlayed on
    // every incorrect attempt.
    const gameFinished = isCorrect || clueNumber >= totalClues;
    const streakInfo = isCorrect
      ? await updatePlayerStreak(userId, userId ? null : guestId, true)
      : null;
    const statsInfo = gameFinished
      ? await updatePlayerStats(userId, userId ? null : guestId, isCorrect, clueNumber)
      : null;

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
          const data: any = {
            seasonId: season.id,
            score: scoreAwarded,
            updatedAt: new Date()
          };
          if (userId) data.userId = userId;
          else data.guestId = guestId;
          await db.leaderboardEntry.create({ data });
        }
      } catch (leaderboardErr) {
        console.error("Failed to update leaderboard score:", {
          name: leaderboardErr instanceof Error ? leaderboardErr.name : "UnknownError"
        });
      }
    }

    recalculatePuzzleDifficulty(puzzle.id).catch((error) => {
      console.error("Difficulty engine failed:", {
        name: error instanceof Error ? error.name : "UnknownError"
      });
    });

    const showAnswer = isCorrect || clueNumber >= totalClues;
    return NextResponse.json({
      correct: isCorrect,
      similarity_score: Number(similarity.toFixed(2)),
      clues_used: clueNumber,
      score_awarded: scoreAwarded,
      answer: showAnswer ? puzzle.answer : undefined,
      streak: streakInfo?.currentStreak ?? 0,
      stats: statsInfo,
      message: isCorrect ? "Correct!" : "Incorrect answer"
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
