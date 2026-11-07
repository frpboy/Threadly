import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createProgressSnapshot } from "@/services/progressService";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const puzzleId = payload?.puzzle_id;
    const guestId = payload?.guest_id;

    if (typeof puzzleId !== "string" || !puzzleId.trim() ||
        (guestId !== undefined && guestId !== null &&
          (typeof guestId !== "string" || guestId.length > 128))) {
      return NextResponse.json(
        { error: "puzzle_id and a valid guest_id are required" },
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
          select: { clueOrder: true, clueText: true },
          orderBy: { clueOrder: "asc" }
        }
      }
    });

    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }
    if (puzzle.clues.length === 0) {
      return NextResponse.json({ error: "Puzzle has no clues" }, { status: 409 });
    }

    const playerFilter = userId ? { userId } : { guestId };
    const guesses = await db.guess.findMany({
      where: { puzzleId: puzzle.id, ...playerFilter },
      select: { guessText: true, isCorrect: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    const progress = createProgressSnapshot(puzzle.clues, guesses, puzzle.answer);
    return NextResponse.json(progress, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Progress POST failed:", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
