// Listing-screenshot content: rewrite ONLY the QA sentinel puzzle (fixed id,
// disposable runner-local database) with realistic, non-launch-pack content.
// The sentinel id keeps real_server_gate.py readiness and malformed-content
// checks intact. Content here is invented for screenshots and is NOT one of
// the 30 launch puzzles, so captures can never spoil a scheduled puzzle.
import { PrismaClient } from '@prisma/client';

const SENTINEL = '00000000-0000-4000-8000-000000000010';
const db = new PrismaClient();

const clues = [
  'I have a needle, but I never sew',
  'Sailors trusted me long before satellites',
  'My needle always settles on the same direction',
  'Hikers and scouts carry me to find their bearings',
  'I point you north when you are lost',
];

if (clues.some(c => c.toLowerCase().includes('compass'))) {
  throw new Error('a clue contains the answer text');
}

const existing = await db.puzzle.findUnique({ where: { id: SENTINEL } });
if (!existing) throw new Error('sentinel puzzle missing; run real_db_gate.cjs seed first');
if (existing.status !== 'published') throw new Error('sentinel puzzle not published');

await db.clue.deleteMany({ where: { puzzleId: SENTINEL } });
await db.puzzle.update({
  where: { id: SENTINEL },
  data: {
    title: 'Finding your way',
    answer: 'compass',
    difficulty: 2,
    clues: { create: clues.map((clueText, i) => ({ clueOrder: i + 1, clueText })) },
  },
});

const check = await db.puzzle.findUnique({ where: { id: SENTINEL }, include: { clues: true } });
if (check.answer !== 'compass' || check.clues.length !== 5) throw new Error('listing content verification failed');
console.log('PASS listing screenshot content on sentinel puzzle, publishedDate untouched:', check.publishedDate?.toISOString());
await db.$disconnect();
