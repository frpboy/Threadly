import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type StatsDatabase = Pick<typeof db, "stats">;

export interface StatsInfo {
  gamesPlayed: number;
  gamesWon: number;
  averageClues: number;
}

export async function updatePlayerStats(
  userId: string | null,
  guestId: string | null,
  isCorrect: boolean,
  cluesRevealed: number,
  client: StatsDatabase = db
): Promise<StatsInfo> {
  const filter = userId ? { userId } : { guestId };

  let stats = await client.stats.findFirst({
    where: filter
  });

  if (!stats) {
    // Create new stats record
    const data = {
      gamesPlayed: 1,
      gamesWon: isCorrect ? 1 : 0,
      averageClues: isCorrect ? new Prisma.Decimal(cluesRevealed) : new Prisma.Decimal(0),
      updatedAt: new Date(),
      ...(userId ? { userId } : { guestId: guestId ?? undefined })
    };

    const newStats = await client.stats.create({
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

  const updatedStats = await client.stats.update({
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
