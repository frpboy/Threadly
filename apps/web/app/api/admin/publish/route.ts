import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { puzzle_id, publish_date } = await req.json();

    if (!puzzle_id) {
      return NextResponse.json(
        { error: "puzzle_id is required" },
        { status: 400 }
      );
    }

    const scheduledDate = publish_date ? new Date(publish_date) : new Date();
    scheduledDate.setUTCHours(0, 0, 0, 0);

    // Update the puzzle status and scheduled date
    const updatedPuzzle = await db.puzzle.update({
      where: { id: puzzle_id },
      data: {
        status: "published",
        publishedDate: scheduledDate
      }
    });

    return NextResponse.json({
      success: true,
      puzzle: updatedPuzzle
    });
  } catch (error: any) {
    console.error("Failed to publish puzzle:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
