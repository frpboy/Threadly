export type ProgressGuess = {
  guessText: string;
  isCorrect: boolean;
};

export type ProgressClue = {
  clueOrder: number;
  clueText: string;
};

export type ProgressRequest = {
  puzzleId: string;
  guestId: string | null;
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

export declare class ProgressError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string);
}

export declare function parseProgressRequest(body: unknown): ProgressRequest;

export declare function loadProgressSnapshot(args: {
  db: unknown;
  userId: string | null;
  request: ProgressRequest;
}): Promise<ProgressSnapshot>;

export declare function createProgressSnapshot(
  clues: ProgressClue[],
  guesses: ProgressGuess[],
  answer: string
): ProgressSnapshot;
