import { betaEnabled, nativePrincipal } from "@/services/nativeBeta/access";
import { validPuzzleContent } from "@/services/puzzleContract";
import { NextResponse } from "next/server";
import { getDailyPuzzle } from "@/services/puzzleService";

export async function GET(request: Request) {
  try {
    if (betaEnabled() && !await nativePrincipal(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const today = new Date();
    const puzzle = await getDailyPuzzle(today);

    if (!puzzle || !validPuzzleContent(puzzle)) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });

    // Return puzzle details (spoiler-free: do not return the answer, and only return Clue 1)
    const firstClue = puzzle.clues.find(c => c.clueOrder === 1);
    
    return NextResponse.json({
      puzzle_id: puzzle.id,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      clues: firstClue ? [{ order: 1, text: firstClue.clueText }] : [],
      total_clues: puzzle.clues.length,
      published_date: puzzle.publishedDate
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Failed to fetch daily puzzle");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
