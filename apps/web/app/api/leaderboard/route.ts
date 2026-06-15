import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// Helper to find or seed the current active season
async function getOrCreateActiveSeason() {
  const today = new Date();
  
  let season = await db.leaderboardSeason.findFirst({
    where: {
      startDate: { lte: today },
      endDate: { gte: today }
    }
  });

  if (!season) {
    // Seed new 30-day season
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    season = await db.leaderboardSeason.create({
      data: {
        name: `Season ${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()}`,
        startDate: today,
        endDate: endDate
      }
    });
  }

  return season;
}

export async function GET() {
  try {
    const season = await getOrCreateActiveSeason();

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

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { score, guest_id } = await req.json();

    if (typeof score !== "number") {
      return NextResponse.json(
        { error: "Score field must be a valid number" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = (session?.user as any)?.id || null;

    if (!userId && !guest_id) {
      return NextResponse.json(
        { error: "User authentication or guest_id required to post score" },
        { status: 401 }
      );
    }

    const season = await getOrCreateActiveSeason();

    const userFilter = userId ? { userId } : { guestId: guest_id };

    let entry = await db.leaderboardEntry.findFirst({
      where: {
        seasonId: season.id,
        ...userFilter
      }
    });

    if (entry) {
      // Update score by adding the points earned
      entry = await db.leaderboardEntry.update({
        where: { id: entry.id },
        data: {
          score: entry.score + score,
          updatedAt: new Date()
        }
      });
    } else {
      // Create a new entry
      const data: any = {
        seasonId: season.id,
        score: score,
        updatedAt: new Date()
      };
      if (userId) data.userId = userId;
      else if (guest_id) data.guestId = guest_id;

      entry = await db.leaderboardEntry.create({
        data
      });
    }

    return NextResponse.json({
      success: true,
      entry_id: entry.id,
      cumulative_score: entry.score
    });
  } catch (error: any) {
    console.error("Leaderboard POST failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
