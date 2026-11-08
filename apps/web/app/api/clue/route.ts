import { validPuzzleContent } from "@/services/puzzleContract";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { validPuzzleId, validGuestId } from "@/services/requestValidation";
import { buildProgress } from "@/services/progressService.ts";
import { prismaHistory } from "@/services/prismaAttemptStore";
import { calculateScore } from "@/services/scoringService";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return privateJson({ error: "Request body must be valid JSON" }, { status: 400 }); }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const { puzzle_id, requested_clue_order, guest_id } = body as Record<string, unknown>;
    if (!validPuzzleId(puzzle_id) || typeof requested_clue_order !== "number" ||
        !Number.isInteger(requested_clue_order) || requested_clue_order < 1 || requested_clue_order > 5) {
      return privateJson({ error: "A valid puzzle_id and integer clue order from 1 to 5 are required" }, { status: 400 });
    }
    const puzzle = await db.puzzle.findUnique({ where: { id: puzzle_id }, include: { clues: true } });
    if (!puzzle || puzzle.status !== "published" || !validPuzzleContent(puzzle)) {
      return privateJson({ error: "Puzzle not found" }, { status: 404 });
    }
    // The first clue is public; later clues use the same authoritative snapshot as progress.
    if (requested_clue_order > 1) {
      const session = await auth();
      const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
      if (!userId && !validGuestId(guest_id)) {
        return privateJson({ error: "guest_id is required for guests" }, { status: 400 });
      }
      const playerKey = userId ? `u:${userId}` : `g:${guest_id}`;
      const history = await prismaHistory()(puzzle.id, playerKey);
      const progress = buildProgress({ history, clues: puzzle.clues.map(c => ({ order: c.clueOrder, text: c.clueText })),
        answer: puzzle.answer, scoreFor: calculateScore });
      if (requested_clue_order > progress.clues.length) {
        return privateJson({ error: "Cannot reveal next clue before attempting a guess on the current clue." }, { status: 403 });
      }
    }
    const clue = puzzle.clues.find(c => c.clueOrder === requested_clue_order)!;
    return privateJson({ order: clue.clueOrder, text: clue.clueText });
  } catch {
    // Do not log submitted identifiers, private history, database URLs or exception payloads.
    console.error("Failed to fetch clue");
    return privateJson({ error: "Internal Server Error" }, { status: 500 });
  }
}
