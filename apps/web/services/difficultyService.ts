import { db } from "@/lib/db";

export async function recalculatePuzzleDifficulty(puzzleId: string): Promise<number> {
  const guesses = await db.guess.findMany({
    where: { puzzleId }
  });

  if (guesses.length === 0) {
    return 1; // Default starting difficulty
  }

  // Get total unique player sessions attempting this puzzle
  const uniquePlayers = new Set<string>();
  let successfulSolves = 0;
  let totalCluesRevealedForSolves = 0;

  guesses.forEach(g => {
    const playerKey = g.userId || g.guestId || "unknown";
    uniquePlayers.add(playerKey);
    if (g.isCorrect) {
      successfulSolves += 1;
      totalCluesRevealedForSolves += g.clueNumber;
    }
  });

  const totalPlayers = uniquePlayers.size;
  if (totalPlayers === 0) return 1;

  const solveRate = successfulSolves / totalPlayers;

  // Map solve rate to a 1 - 10 scale (where 1 is easiest, 10 is hardest)
  let difficulty = 1;
  if (solveRate >= 0.90) {
    difficulty = 1;
  } else if (solveRate >= 0.80) {
    difficulty = 2;
  } else if (solveRate >= 0.70) {
    difficulty = 3;
  } else if (solveRate >= 0.60) {
    difficulty = 4;
  } else if (solveRate >= 0.50) {
    difficulty = 5;
  } else if (solveRate >= 0.40) {
    difficulty = 6;
  } else if (solveRate >= 0.30) {
    difficulty = 7;
  } else if (solveRate >= 0.20) {
    difficulty = 8;
  } else if (solveRate >= 0.10) {
    difficulty = 9;
  } else {
    difficulty = 10;
  }

  // Factor in average clues revealed to solve
  if (successfulSolves > 0) {
    const avgClues = totalCluesRevealedForSolves / successfulSolves;
    if (avgClues > 4) {
      difficulty = Math.min(10, difficulty + 1);
    } else if (avgClues < 2) {
      difficulty = Math.max(1, difficulty - 1);
    }
  }

  await db.puzzle.update({
    where: { id: puzzleId },
    data: { difficulty }
  });

  return difficulty;
}
