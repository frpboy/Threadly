export class ProgressError extends Error {
  constructor(status, code) {
    super(code);
    this.name = "ProgressError";
    this.status = status;
    this.code = code;
  }
}

export function parseProgressRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ProgressError(400, "INVALID_REQUEST_BODY");
  }

  const puzzleId = body.puzzle_id;
  const rawGuestId = body.guest_id;
  if (typeof puzzleId !== "string" || !puzzleId.trim()) {
    throw new ProgressError(400, "INVALID_PUZZLE_ID");
  }

  if (rawGuestId !== undefined && rawGuestId !== null &&
      (typeof rawGuestId !== "string" || !rawGuestId.trim() || rawGuestId.length > 128)) {
    throw new ProgressError(400, "INVALID_GUEST_ID");
  }

  return {
    puzzleId: puzzleId.trim(),
    guestId: typeof rawGuestId === "string" ? rawGuestId.trim() : null
  };
}

export async function loadProgressSnapshot({ db, userId, request }) {
  if (!userId && !request.guestId) {
    throw new ProgressError(401, "AUTHENTICATION_OR_GUEST_ID_REQUIRED");
  }

  const puzzle = await db.puzzle.findUnique({
    where: { id: request.puzzleId },
    include: {
      clues: {
        select: { clueOrder: true, clueText: true },
        orderBy: { clueOrder: "asc" }
      }
    }
  });

  if (!puzzle) {
    throw new ProgressError(404, "PUZZLE_NOT_FOUND");
  }
  if (!Array.isArray(puzzle.clues) || puzzle.clues.length === 0) {
    throw new ProgressError(409, "PUZZLE_HAS_NO_CLUES");
  }

  // An authenticated account always takes precedence over a client-supplied guest ID.
  const playerFilter = userId ? { userId } : { guestId: request.guestId };
  const guesses = await db.guess.findMany({
    where: { puzzleId: puzzle.id, ...playerFilter },
    select: { guessText: true, isCorrect: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  return createProgressSnapshot(puzzle.clues, guesses, puzzle.answer);
}

export function createProgressSnapshot(clues, guesses, answer) {
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

  const snapshot = {
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
