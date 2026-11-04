import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  // Enforce administrative authorization to prevent leakage of unpublished puzzles and solutions
  if (!verifyAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const puzzles = await db.puzzle.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        clues: {
          orderBy: {
            clueOrder: "asc"
          }
        }
      }
    });

    return NextResponse.json({
      puzzles: puzzles.map(p => ({
        id: p.id,
        title: p.title,
        answer: p.answer,
        difficulty: p.difficulty,
        status: p.status,
        published_date: p.publishedDate,
        clues: p.clues.map(c => c.clueText)
      }))
    });
  } catch (error: any) {
    console.error("Failed to fetch admin puzzles:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
