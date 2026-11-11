import { validPuzzleContent } from "@/services/puzzleContract";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  // Enforce administrative authorization to prevent unauthorized publishing/scheduling of puzzles
  if (!verifyAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { puzzle_id, publish_date } = await req.json();

    if (!puzzle_id) {
      return NextResponse.json(
        { error: "puzzle_id is required" },
        { status: 400 }
      );
    }

    const scheduledDate = publish_date ? new Date(publish_date) : new Date();
    if (!Number.isFinite(scheduledDate.getTime())) return NextResponse.json({ error: "Invalid publish_date" }, { status: 400 });
    scheduledDate.setUTCHours(0, 0, 0, 0);

    // Read and publish inside one transaction. Invalid stored content never changes status.
    const updatedPuzzle = await db.$transaction(async (tx) => {
      const puzzle = await tx.puzzle.findUnique({ where: { id: puzzle_id }, include: { clues: true } });
      if (!puzzle) return null;
      if (!validPuzzleContent(puzzle)) return false;
      return tx.puzzle.update({ where: { id: puzzle_id }, data: { status: "published", publishedDate: scheduledDate } });
    });
    if (updatedPuzzle === null) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    if (updatedPuzzle === false) return NextResponse.json({ error: "Puzzle requires five valid ordered clues" }, { status: 400 });

    return NextResponse.json({
      success: true,
      puzzle: updatedPuzzle
    });
  } catch (error: any) {
    console.error("Failed to publish puzzle");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
