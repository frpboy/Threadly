import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const puzzle = await db.puzzle.findUnique({
      where: { id },
      include: {
        clues: {
          orderBy: {
            clueOrder: "asc"
          }
        }
      }
    });

    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

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
    console.error("Failed to fetch archive puzzle details:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
