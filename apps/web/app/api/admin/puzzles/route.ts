import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
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
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
