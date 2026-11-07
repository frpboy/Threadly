// Server-authoritative attempt logic for Threadly.
// The client never decides how many clues were used. The server derives it from its own guess log.
// Pure logic plus a small store interface so it can be tested without a database.

export const MAX_CLUES = 5;

export interface GuessRecord {
  clueNumber: number;
  isCorrect: boolean;
  guessText: string;
  scoreAwarded: number;
}

export type AttemptState =
  | { kind: "open"; clueNumber: number }           // next guess is made on this clue
  | { kind: "solved"; record: GuessRecord }        // already solved, no more guesses
  | { kind: "exhausted" };                         // all clues used without a solve

/** Derive the current state from this player's guess history for one puzzle. */
export function deriveState(history: GuessRecord[]): AttemptState {
  const solved = history.find((g) => g.isCorrect);
  if (solved) return { kind: "solved", record: solved };
  const highest = history.reduce((m, g) => Math.max(m, g.clueNumber), 0);
  if (highest >= MAX_CLUES) return { kind: "exhausted" };
  // A guess on clue N is what unlocks clue N+1 (matches /api/clue gating).
  return { kind: "open", clueNumber: highest + 1 };
}

export interface AttemptStore {
  history(puzzleId: string, playerKey: string): Promise<GuessRecord[]>;
  /**
   * Must be backed by a UNIQUE constraint on (puzzleId, playerKey, clueNumber).
   * Returns "conflict" when a row for that clue already exists (concurrent or replayed request).
   */
  insertGuess(puzzleId: string, playerKey: string, rec: GuessRecord): Promise<"inserted" | "conflict">;
}

export type GuessOutcome =
  | { status: "scored"; correct: boolean; cluesUsed: number; scoreAwarded: number }
  | { status: "already_solved"; cluesUsed: number; scoreAwarded: number }
  | { status: "exhausted" }
  | { status: "replay" }; // a concurrent/replayed request already consumed this clue slot; nothing is scored

export async function processGuess(
  store: AttemptStore,
  args: {
    puzzleId: string;
    playerKey: string;
    guessText: string;
    isCorrect: boolean; // computed by the caller from the answer matcher
    scoreFor: (cluesUsed: number) => number;
  }
): Promise<GuessOutcome> {
  const state = deriveState(await store.history(args.puzzleId, args.playerKey));
  if (state.kind === "solved") {
    return { status: "already_solved", cluesUsed: state.record.clueNumber, scoreAwarded: state.record.scoreAwarded };
  }
  if (state.kind === "exhausted") return { status: "exhausted" };

  const cluesUsed = state.clueNumber;
  const scoreAwarded = args.isCorrect ? args.scoreFor(cluesUsed) : 0;
  const res = await store.insertGuess(args.puzzleId, args.playerKey, {
    clueNumber: cluesUsed,
    isCorrect: args.isCorrect,
    guessText: args.guessText,
    scoreAwarded,
  });
  // Only the request that wins the insert may add score, streak or stats.
  if (res === "conflict") return { status: "replay" };
  return { status: "scored", correct: args.isCorrect, cluesUsed, scoreAwarded };
}
