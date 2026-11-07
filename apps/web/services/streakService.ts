import { db } from "@/lib/db";

type StreakDatabase = Pick<typeof db, "streak">;

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
}

export async function updatePlayerStreak(
  userId: string | null,
  guestId: string | null,
  isCorrect: boolean,
  client: StreakDatabase = db
): Promise<StreakInfo> {
  if (!isCorrect) {
    // Streaks only update on successful connections/solves
    const record = await getStreakRecord(userId, guestId, client);
    return {
      currentStreak: record?.currentStreak || 0,
      bestStreak: record?.bestStreak || 0
    };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const filter = userId ? { userId } : { guestId };

  let streak = await client.streak.findFirst({
    where: filter
  });

  if (!streak) {
    // Create new streak record
    const data = {
      currentStreak: 1,
      bestStreak: 1,
      updatedAt: new Date(),
      ...(userId ? { userId } : { guestId: guestId ?? undefined })
    };

    const newStreak = await client.streak.create({
      data
    });

    return {
      currentStreak: newStreak.currentStreak,
      bestStreak: newStreak.bestStreak
    };
  }

  // Calculate day difference
  const lastUpdate = new Date(streak.updatedAt);
  lastUpdate.setUTCHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lastUpdate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let newCurrent = streak.currentStreak;
  if (diffDays === 1) {
    // Solved the next day, increment
    newCurrent += 1;
  } else if (diffDays > 1) {
    // Broke the streak, reset to 1
    newCurrent = 1;
  } else if (diffDays === 0 && streak.currentStreak === 0) {
    // Initializing same-day play
    newCurrent = 1;
  }

  const newBest = Math.max(streak.bestStreak, newCurrent);

  const updatedStreak = await client.streak.update({
    where: { id: streak.id },
    data: {
      currentStreak: newCurrent,
      bestStreak: newBest,
      updatedAt: new Date()
    }
  });

  return {
    currentStreak: updatedStreak.currentStreak,
    bestStreak: updatedStreak.bestStreak
  };
}

async function getStreakRecord(userId: string | null, guestId: string | null, client: StreakDatabase) {
  const filter = userId ? { userId } : { guestId: guestId || "none" };
  return await client.streak.findFirst({
    where: filter
  });
}
