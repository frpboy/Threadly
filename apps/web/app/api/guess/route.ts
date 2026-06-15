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
    const { puzzle_id, guess, clues_revealed = 1, guest_id } = await req.json();

    if (!puzzle_id || !guess) {
      return NextResponse.json(
        { error: "puzzle_id and guess fields are required" },
        { status: 400 }
      );
    }

    const puzzle = await db.puzzle.findUnique({
      where: { id: puzzle_id }
    });

    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    // Get current session for logged in user
    const session = await auth();
    const userId = (session?.user as any)?.id || null;

    const { isCorrect, similarity } = checkAnswer(guess, puzzle.answer);
    
    let scoreAwarded = 0;
    if (isCorrect) {
      scoreAwarded = calculateScore(clues_revealed);
    }

    // Log the guess auditing in DB
    await db.guess.create({
      data: {
        userId,
        guestId: guest_id || null,
        puzzleId: puzzle.id,
        guessText: guess,
        isCorrect: isCorrect,
        clueNumber: clues_revealed
      }
    });

    // Update player streak and statistics
    const streakInfo = await updatePlayerStreak(userId, guest_id || null, isCorrect);
    const statsInfo = await updatePlayerStats(userId, guest_id || null, isCorrect, clues_revealed);

    // If solved correctly, log score to the active leaderboard season
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
              name: `Season ${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()}`,
              startDate: today,
              endDate: endDate
            }
          });
        }
        
        const userFilter = userId ? { userId } : { guestId: guest_id };
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
          else if (guest_id) data.guestId = guest_id;
          await db.leaderboardEntry.create({ data });
        }
      } catch (leaderboardErr) {
        console.error("Failed to update leaderboard score:", leaderboardErr);
      }
    }

    // Run dynamic difficulty assessment asynchronously in background
    recalculatePuzzleDifficulty(puzzle.id).catch(err => {
      console.error("Difficulty engine failed:", err);
    });

    const showAnswer = isCorrect || clues_revealed >= 5;

    return NextResponse.json({
      correct: isCorrect,
      similarity_score: parseFloat(similarity.toFixed(2)),
      clues_used: clues_revealed,
      score_awarded: scoreAwarded,
      answer: showAnswer ? puzzle.answer : undefined,
      streak: streakInfo.currentStreak,
      stats: statsInfo,
      message: isCorrect ? "Correct!" : "Incorrect answer"
    });
  } catch (error: any) {
    console.error("Failed to process guess:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
