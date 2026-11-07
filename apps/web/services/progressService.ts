import { validPuzzleContent } from "./puzzleContract.ts";
import { MAX_CLUES, deriveState } from "./attemptService.ts";
import type { GuessRecord } from "./attemptService.ts";

export interface ProgressClue { order: number; text: string }
export interface Progress {
  state: "open" | "solved" | "exhausted";
  clue_number: number;            // clue the next guess is made on (open) or last clue used (finished)
  clues: ProgressClue[];          // every clue the player has unlocked
  guesses: string[];              // guesses already made, oldest first
  total_clues: number;
  score_awarded: number;
  answer?: string;                // only once the player has solved or used every clue
}

/** Pure: what a client needs to resume a puzzle. Never returns clues the player has not unlocked. */
export function buildProgress(args: {
  history: GuessRecord[];
  clues: ProgressClue[];
  answer: string;
  scoreFor: (cluesUsed: number) => number;
}): Progress {
  const { history, answer, scoreFor } = args;
  if (!validPuzzleContent({ answer, clues: args.clues.map(c => ({ clueOrder: c.order, clueText: c.text })) })) {
    throw new Error("Invalid published puzzle content");
  }
  const state = deriveState(history);
  const total = Math.min(MAX_CLUES, args.clues.length);
  const sorted = [...history].sort((a, b) => a.clueNumber - b.clueNumber);
  const guesses = sorted.map((g) => g.guessText);
  const base = { guesses, total_clues: total };
  const upTo = (n: number) => args.clues.filter((c) => c.order <= n).sort((a, b) => a.order - b.order);
  if (state.kind === "open") {
    return { ...base, state: "open", clue_number: state.clueNumber, clues: upTo(state.clueNumber), score_awarded: 0 };
  }
  const last = sorted.length ? sorted[sorted.length - 1].clueNumber : 1;
  if (state.kind === "solved") {
    const n = state.record.clueNumber;
    return { ...base, state: "solved", clue_number: n, clues: upTo(n), score_awarded: scoreFor(n), answer };
  }
  return { ...base, state: "exhausted", clue_number: last, clues: upTo(last), score_awarded: 0, answer };
}
