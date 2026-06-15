import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface StatsInfo {
  gamesPlayed: number;
  gamesWon: number;
  averageClues: number;
}

export async function updatePlayerStats(
  userId: string | null,
  guestId: string | null,
  isCorrect: boolean,
  cluesRevealed: number
): Promise<StatsInfo> {
  const filter = userId ? { userId } : { guestId };

  let stats = await db.stats.findFirst({
    where: filter
  });

  if (!stats) {
    // Create new stats record
    const data: any = {
      gamesPlayed: 1,
      gamesWon: isCorrect ? 1 : 0,
      averageClues: isCorrect ? new Prisma.Decimal(cluesRevealed) : new Prisma.Decimal(0),
      updatedAt: new Date()
    };
    if (userId) data.userId = userId;
    else if (guestId) data.guestId = guestId;

    const newStats = await db.stats.create({
      data
    });

    return {
      gamesPlayed: newStats.gamesPlayed,
      gamesWon: newStats.gamesWon,
      averageClues: Number(newStats.averageClues)
    };
  }

  const newGamesPlayed = stats.gamesPlayed + 1;
  const newGamesWon = stats.gamesWon + (isCorrect ? 1 : 0);
  
  let newAverageClues = Number(stats.averageClues);
  if (isCorrect) {
    newAverageClues = ((Number(stats.averageClues) * stats.gamesWon) + cluesRevealed) / newGamesWon;
  }

  const updatedStats = await db.stats.update({
    where: { id: stats.id },
    data: {
      gamesPlayed: newGamesPlayed,
      gamesWon: newGamesWon,
      averageClues: new Prisma.Decimal(parseFloat(newAverageClues.toFixed(2))),
      updatedAt: new Date()
    }
  });

  return {
    gamesPlayed: updatedStats.gamesPlayed,
    gamesWon: updatedStats.gamesWon,
    averageClues: Number(updatedStats.averageClues)
  };
}
