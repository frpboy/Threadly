// Pure mapping from the /api/progress response to the page's UI state. Kept free of React so it can be tested.
export interface ProgressResponse {
  state: "open" | "solved" | "exhausted";
  clue_number: number;
  clues: { order: number; text: string }[];
  guesses: string[];
  total_clues: number;
  score_awarded: number;
  answer?: string;
}

export interface UiState {
  clues: { order: number; text: string }[];
  cluesRevealed: number;
  guesses: string[];
  isGameOver: boolean;
  isCorrect: boolean;
  score: number;
  correctAnswer: string;
}

export function progressToUiState(p: ProgressResponse): UiState {
  const finished = p.state !== "open";
  return {
    clues: p.clues,
    cluesRevealed: p.clue_number,
    // a solved game's last guess is the correct one; show only the misses as "guesses so far"
    guesses: p.state === "solved" ? p.guesses.slice(0, -1) : p.guesses,
    isGameOver: finished,
    isCorrect: p.state === "solved",
    score: p.score_awarded,
    correctAnswer: finished ? p.answer ?? "" : "",
  };
}

/** The guess API answers 409 when the server's state differs from the client's (replay, solved, exhausted). */
export function shouldResync(httpStatus: number): boolean {
  return httpStatus === 409;
}
