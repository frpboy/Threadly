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

export declare function createProgressSnapshot(
  clues: ProgressClue[],
  guesses: ProgressGuess[],
  answer: string
): ProgressSnapshot;
