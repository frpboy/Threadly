import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { checkAnswer } from "@/services/answerService";
import { calculateScore } from "@/services/scoringService";

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

    const showAnswer = isCorrect || clues_revealed >= 5;

    return NextResponse.json({
      correct: isCorrect,
      similarity_score: parseFloat(similarity.toFixed(2)),
      clues_used: clues_revealed,
      score_awarded: scoreAwarded,
      answer: showAnswer ? puzzle.answer : undefined,
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
