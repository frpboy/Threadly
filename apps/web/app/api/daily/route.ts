import { NextResponse } from "next/server";
import { getDailyPuzzle } from "@/services/puzzleService";

export async function GET() {
  try {
    const today = new Date();
    const puzzle = await getDailyPuzzle(today);

    // Return puzzle details (spoiler-free: do not return the answer, and only return Clue 1)
    const firstClue = puzzle.clues.find(c => c.clueOrder === 1);
    
    return NextResponse.json({
      puzzle_id: puzzle.id,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      clues: firstClue ? [{ order: 1, text: firstClue.clueText }] : [],
      total_clues: puzzle.clues.length,
      published_date: puzzle.publishedDate
    });
  } catch (error: any) {
    console.error("Failed to fetch daily puzzle:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
