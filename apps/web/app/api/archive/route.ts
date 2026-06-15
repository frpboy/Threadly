import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const puzzles = await db.puzzle.findMany({
      where: {
        status: "published",
        publishedDate: {
          lt: today
        }
      },
      orderBy: {
        publishedDate: "desc"
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
        difficulty: p.difficulty,
        published_date: p.publishedDate,
        total_clues: p.clues.length,
        first_clue: p.clues.find(c => c.clueOrder === 1)?.clueText || ""
      }))
    });
  } catch (error: any) {
    console.error("Failed to fetch archive puzzles:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
