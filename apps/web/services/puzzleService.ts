// Puzzle Service for Threadly
import { db } from "@/lib/db";

export async function getDailyPuzzle(today: Date) {
  today.setUTCHours(0, 0, 0, 0);

  // Find puzzle published for today
  let puzzle = await db.puzzle.findFirst({
    where: {
      publishedDate: today,
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

  // Fallback: If no puzzle is scheduled for today, fetch the latest published puzzle
  if (!puzzle) {
    puzzle = await db.puzzle.findFirst({
      where: {
        status: "published"
      },
      orderBy: {
        createdAt: "desc"
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

  // Fallback 2: If database is completely empty, seed a default puzzle
  if (!puzzle) {
    puzzle = await db.puzzle.create({
      data: {
        title: "Popular Tech stack connection",
        answer: "programming languages",
        difficulty: 1,
        publishedDate: today,
        status: "published",
        clues: {
          create: [
            { clueOrder: 1, clueText: "Python" },
            { clueOrder: 2, clueText: "JavaScript" },
            { clueOrder: 3, clueText: "Rust" },
            { clueOrder: 4, clueText: "Go" },
            { clueOrder: 5, clueText: "Swift" }
          ]
        }
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

  return puzzle;
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
