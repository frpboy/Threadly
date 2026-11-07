import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET() {
  try {
    // GET is read-only. Only the transactional scoring path may create a season.
    const today = new Date();
    const season = await db.leaderboardSeason.findFirst({
      where: { startDate: { lte: today }, endDate: { gte: today } },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
    if (!season) return privateJson({ season_name: null, ends_at: null, entries: [] });

    const entries = await db.leaderboardEntry.findMany({
      where: { seasonId: season.id },
      orderBy: { score: "desc" },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    return privateJson({
      season_name: season.name,
      ends_at: season.endDate,
      entries: entries.map(e => ({
        id: e.id,
        score: e.score,
        username: e.user?.username || e.user?.name || `Guest_${e.guestId?.substring(0, 5)}`,
        avatar: e.user?.image || null
      }))
    });
  } catch (error: any) {
    console.error("Leaderboard GET failed:", error);
    return privateJson(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Scores are awarded only by /api/guess inside its transaction. Never accept client points.
export async function POST() {
  return privateJson(
    { error: "Client score submission is disabled; submit a puzzle guess instead" },
    { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } }
  );
}
