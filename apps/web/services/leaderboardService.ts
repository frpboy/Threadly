import type { DbClient } from "@/lib/dbClient";

/**
 * Adds points to the active season (creating the season if needed).
 * Errors are NOT swallowed: inside a transaction a failure must roll the whole guess back.
 */
export async function addLeaderboardScore(
  client: DbClient,
  userId: string | null,
  guestId: string | null,
  score: number
): Promise<void> {
  // Called only inside the guess transaction. Serialize season creation AND score read-modify-write.
  // All participating writers use this lock; GET and the public POST no longer write.
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "threadly:leaderboard"
  );
  const today = new Date();
  let season = await client.leaderboardSeason.findFirst({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  if (!season) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    season = await client.leaderboardSeason.create({
      data: {
        name: `Season ${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}`,
        startDate: today,
        endDate,
      },
    });
  }
  const userFilter = userId ? { userId } : { guestId };
  const existing = await client.leaderboardEntry.findFirst({ where: { seasonId: season.id, ...userFilter } });
  if (existing) {
    await client.leaderboardEntry.update({ where: { id: existing.id }, data: { score: existing.score + score } });
  } else {
    await client.leaderboardEntry.create({
      data: { seasonId: season.id, score, updatedAt: new Date(), ...(userId ? { userId } : { guestId }) },
    });
  }
}
