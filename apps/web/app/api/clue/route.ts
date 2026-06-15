import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const { puzzle_id, requested_clue_order, guest_id } = await req.json();

    if (!puzzle_id || typeof requested_clue_order !== "number") {
      return NextResponse.json(
        { error: "puzzle_id and requested_clue_order are required" },
        { status: 400 }
      );
    }

    if (requested_clue_order < 1 || requested_clue_order > 5) {
      return NextResponse.json(
        { error: "Invalid requested clue order" },
        { status: 400 }
      );
    }

    // Clue 1 is always public
    if (requested_clue_order > 1) {
      // Find session if logged in
      const session = await auth();
      const userId = (session?.user as any)?.id || null;

      // Check for guess logs
      const userFilter = userId ? { userId } : { guestId: guest_id || "guest-none" };
      
      const previousGuess = await db.guess.findFirst({
        where: {
          puzzleId: puzzle_id,
          clueNumber: requested_clue_order - 1,
          ...userFilter
        }
      });

      if (!previousGuess) {
        return NextResponse.json(
          { error: "Cannot reveal next clue before attempting a guess on the current clue." },
          { status: 403 }
        );
      }
    }

    // Fetch the specific clue
    const clue = await db.clue.findFirst({
      where: {
        puzzleId: puzzle_id,
        clueOrder: requested_clue_order
      }
    });

    if (!clue) {
      return NextResponse.json(
        { error: "Clue not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      order: clue.clueOrder,
      text: clue.clueText
    });
  } catch (error: any) {
    console.error("Failed to fetch clue:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
