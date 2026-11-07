import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { DbClient } from "@/lib/dbClient";
import { updatePlayerStreak } from "@/services/streakService";
import { updatePlayerStats } from "@/services/statsService";
import { addLeaderboardScore } from "@/services/leaderboardService";
import { INSERT_GUESS_SQL, SELECT_HISTORY_SQL } from "./guessSql.ts";
import type { AttemptStore, GuessRecord } from "./attemptService.ts";
import type { GuessUnitOfWork, RunInTransaction } from "./guessTransaction.ts";

/**
 * Read-only history used outside a transaction (progress endpoint).
 */
export function prismaHistory(client: DbClient = db): AttemptStore["history"] {
  return async (puzzleId, playerKey) => {
    const isUser = playerKey.startsWith("u:");
    const id = playerKey.slice(2);
    const rows = await client.$queryRawUnsafe<Pick<GuessRecord, "clueNumber" | "isCorrect" | "guessText">[]>(
      SELECT_HISTORY_SQL, puzzleId, playerKey, isUser ? id : null, isUser ? null : id
    );
    return rows.map((r): GuessRecord => ({ ...r, scoreAwarded: 0 }));
  };
}

/**
 * Prisma unit of work over an interactive transaction client.
 * insertGuess needs the partial unique index from prisma/drafts/guess_player_key.up.sql.
 * Without that index there is NO replay protection: do not enable before the migration is applied.
 */
export function prismaUnitOfWork(tx: DbClient): GuessUnitOfWork {
  return {
    history: prismaHistory(tx),
    async insertGuess(puzzleId, playerKey, rec) {
      const isUser = playerKey.startsWith("u:");
      const id = playerKey.slice(2);
      // ON CONFLICT DO NOTHING (not catch-P2002): a unique violation would abort the whole Postgres transaction.
      const n = await (tx as any).$executeRawUnsafe(
        INSERT_GUESS_SQL,
        randomUUID(), isUser ? id : null, isUser ? null : id, puzzleId,
        rec.guessText, rec.isCorrect, rec.clueNumber, playerKey
      );
      return n === 1 ? "inserted" : "conflict";
    },
    async award(a) {
      // Same player can finish DIFFERENT puzzles concurrently. Serialize their stats/streak writes.
      // Use executeRaw: a SELECT returning PostgreSQL void cannot be decoded by Prisma queryRaw.
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", `threadly:award:${a.playerKey}`
      );
      const streak = await updatePlayerStreak(a.userId, a.guestId, a.correct, tx);
      // gamesPlayed counts finished games, not every guess (the old route incremented it on each guess).
      const stats = a.finished
        ? await updatePlayerStats(a.userId, a.guestId, a.correct, a.cluesUsed, tx)
        : undefined;
      if (a.correct && a.scoreAwarded > 0) await addLeaderboardScore(tx, a.userId, a.guestId, a.scoreAwarded);
      return { streak, stats };
    },
  };
}

export const runInPrismaTransaction: RunInTransaction = (fn) =>
  db.$transaction((tx) => fn(prismaUnitOfWork(tx)), { timeout: 15000 });
