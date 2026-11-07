export type ProgressGuess = {
  guessText: string;
  isCorrect: boolean;
};

export type ProgressClue = {
  clueOrder: number;
  clueText: string;
};

export type ProgressSnapshot = {
  state: "open" | "solved" | "exhausted";
  clue_number: number;
  clues: Array<{ order: number; text: string }>;
  guesses: string[];
  total_clues: number;
  score_awarded: number;
  answer?: string;
};

/**
 * Build the public Android progress payload from ordered, player-scoped
 * persisted guesses. The answer is omitted until the game is finished.
 */
export function createProgressSnapshot(
  clues: ProgressClue[],
  guesses: ProgressGuess[],
  answer: string
): ProgressSnapshot {
  const totalClues = clues.length;
  const solvedAt = guesses.findIndex((guess) => guess.isCorrect);
  const solved = solvedAt >= 0;
  const acceptedGuesses = solved
    ? guesses.slice(0, solvedAt + 1)
    : guesses.slice(0, totalClues);
  const exhausted = !solved && acceptedGuesses.length >= totalClues;

  const clueNumber = solved
    ? Math.min(solvedAt + 1, totalClues)
    : exhausted
      ? totalClues
      : Math.min(acceptedGuesses.length + 1, totalClues);

  const snapshot: ProgressSnapshot = {
    state: solved ? "solved" : exhausted ? "exhausted" : "open",
    clue_number: clueNumber,
    clues: clues
      .filter((clue) => clue.clueOrder <= clueNumber)
      .map((clue) => ({ order: clue.clueOrder, text: clue.clueText })),
    guesses: acceptedGuesses.map((guess) => guess.guessText),
    total_clues: totalClues,
    score_awarded: solved ? Math.max(20, 120 - clueNumber * 20) : 0
  };

  if (solved || exhausted) snapshot.answer = answer;
  return snapshot;
}
