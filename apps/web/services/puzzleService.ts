// Puzzle Service for Threadly
import { db } from "@/lib/db";

/** Start of the UTC day containing `now`. */
function utcDayStart(now: Date): Date {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * A published puzzle becomes serveable when its UTC publication day begins.
 * Future-dated puzzles (scheduled ahead) must never be served or guessed on,
 * and a null publication date means the puzzle is not scheduled at all.
 */
export function publicationDayReached(puzzle: { publishedDate: Date | null }, now: Date): boolean {
  return puzzle.publishedDate !== null && puzzle.publishedDate.getTime() <= utcDayStart(now).getTime();
}

/**
 * The daily puzzle is exactly the puzzle published for this UTC day.
 * Reads stay reads: a GET never creates fallback content, and no past or
 * future puzzle is substituted when nothing is scheduled for today.
 */
export async function getDailyPuzzle(today: Date) {
  const day = utcDayStart(today);

  // Find the puzzle published for today, and only today.
  return await db.puzzle.findFirst({
    where: {
      publishedDate: day,
      status: "published"
    },
    include: {
      clues: {
        orderBy: {
          clueOrder: "asc"
        }
      }
    }
  });
}

export async function getPuzzleById(id: string) {
  return await db.puzzle.findUnique({
    where: { id },
    include: {
      clues: {
        orderBy: {
          clueOrder: "asc"
        }
      }
    }
  });
}
