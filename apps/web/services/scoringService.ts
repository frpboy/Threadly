// Scoring Service for Threadly

export function calculateScore(cluesRevealedCount: number): number {
  // 1 Clue = 100 points
  // 2 Clues = 80 points
  // 3 Clues = 60 points
  // 4 Clues = 40 points
  // 5 Clues = 20 points
  return Math.max(20, 120 - cluesRevealedCount * 20);
}
