import { MAX_CLUES, processGuess } from "./attemptService.ts";
import type { AttemptStore, GuessOutcome } from "./attemptService.ts";

export interface AwardArgs {
  playerKey: string;
  userId: string | null;
  guestId: string | null;
  correct: boolean;
  cluesUsed: number;
  scoreAwarded: number;
  /** true when this guess ended the game for the player (solved, or the 5th clue was used). */
  finished: boolean;
}

export interface GuessUnitOfWork extends AttemptStore {
  /** Streak, stats and leaderboard writes. Must throw on any failure so the transaction rolls back. */
  award(args: AwardArgs): Promise<unknown>;
}

export interface SubmitArgs {
  puzzleId: string;
  playerKey: string;
  guessText: string;
  isCorrect: boolean;
  scoreFor: (cluesUsed: number) => number;
}

export type RunInTransaction = <T>(fn: (uow: GuessUnitOfWork) => Promise<T>) => Promise<T>;

/**
 * The guess row and every award write happen inside ONE transaction.
 * - process dies before commit: nothing is stored, the client retries and is scored once.
 * - award throws: the guess row rolls back too, so a retry is not treated as a replay.
 * - concurrent duplicate: loses the unique-index insert, writes nothing else.
 */
export async function submitGuess(runInTransaction: RunInTransaction, args: SubmitArgs) {
  return runInTransaction(async (uow) => {
    const outcome: GuessOutcome = await processGuess(uow, args);
    if (outcome.status !== "scored") return { outcome, award: undefined as unknown };
    const finished = outcome.correct || outcome.cluesUsed >= MAX_CLUES;
    const isUser = args.playerKey.startsWith("u:");
    const id = args.playerKey.slice(2);
    const award = await uow.award({
      playerKey: args.playerKey,
      userId: isUser ? id : null,
      guestId: isUser ? null : id,
      correct: outcome.correct,
      cluesUsed: outcome.cluesUsed,
      scoreAwarded: outcome.scoreAwarded,
      finished,
    });
    return { outcome, award };
  });
}
