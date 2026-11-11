/** Published gameplay requires five distinct, nonempty clues at exact orders 1..5. */
export function validPuzzleContent(puzzle: { answer?: unknown; clues?: unknown } | null | undefined): boolean {
  if (!puzzle || typeof puzzle.answer !== "string" || !puzzle.answer.trim() || !Array.isArray(puzzle.clues) || puzzle.clues.length !== 5) return false;
  const orders = new Set<number>();
  for (const clue of puzzle.clues) {
    if (!clue || !Number.isInteger(clue.clueOrder) || clue.clueOrder < 1 || clue.clueOrder > 5 ||
        typeof clue.clueText !== "string" || !clue.clueText.trim() || orders.has(clue.clueOrder)) return false;
    orders.add(clue.clueOrder);
  }
  return orders.size === 5;
}
