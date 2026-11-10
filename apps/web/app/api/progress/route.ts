import { boundedJson } from "@/services/nativeBeta/body";
import { betaEnabled, nativePrincipal } from "@/services/nativeBeta/access";
import { validPuzzleContent } from "@/services/puzzleContract";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { calculateScore } from "@/services/scoringService";
import { buildProgress } from "@/services/progressService.ts";
import { prismaHistory } from "@/services/prismaAttemptStore";
import { validPuzzleId, validGuestId } from "@/services/requestValidation";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

// Lets a client resume a puzzle: which clues are unlocked, past guesses, and the result once finished.
// POST (not GET) so the guest id stays out of URLs and logs. Read-only.
export async function POST(req: NextRequest) {
  try {
    const beta = betaEnabled();
    const device = beta ? await nativePrincipal(req) : null;
    if (beta && !device) return privateJson({ error: "Unauthorized" }, { status: 401 });
    let body: unknown;
    try {
      body = beta ? await boundedJson(req) : await req.json();
    } catch {
      return privateJson({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const { puzzle_id, guest_id: claimedGuestId } = body as Record<string, unknown>;
    const guest_id = device?.guestId ?? claimedGuestId;
    if (!validPuzzleId(puzzle_id)) {
      return privateJson({ error: "puzzle_id is required" }, { status: 400 });
    }
    const session = beta ? null : await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    if (!userId && !validGuestId(guest_id)) {
      return privateJson({ error: "guest_id is required for guests" }, { status: 400 });
    }
    const puzzle = await db.puzzle.findUnique({
      where: { id: puzzle_id },
      include: { clues: { orderBy: { clueOrder: "asc" } } },
    });
    if (!puzzle || puzzle.status !== "published" || !validPuzzleContent(puzzle)) {
      return privateJson({ error: "Puzzle not found" }, { status: 404 });
    }
    const playerKey = userId ? `u:${userId}` : `g:${guest_id}`;
    const history = await prismaHistory()(puzzle.id, playerKey);
    const progress = buildProgress({
      history,
      clues: puzzle.clues.map((c) => ({ order: c.clueOrder, text: c.clueText })),
      answer: puzzle.answer,
      scoreFor: calculateScore,
    });
    return privateJson(progress);
  } catch (error) {
    console.error("Failed to load progress");
    return privateJson({ error: "Internal Server Error" }, { status: 500 });
  }
}
