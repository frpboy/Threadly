// Seed the 30-day launch puzzle pack (TASK-015) from packs/launch-30.json.
//
// Safety contract:
//   - DRY RUN by default: validates and prints the plan, writes nothing.
//   - Writes only with LAUNCH_PACK_APPLY=1 and an explicit start date:
//       START_DATE=2026-12-01 LAUNCH_PACK_APPLY=1 node prisma/seed-launch-pack.mjs
//   - Idempotent per date: a date already holding a puzzle is skipped, never
//     overwritten (publishedDate is unique in the schema).
//   - Requires the production DATABASE_URL in the environment; refuses to run
//     if the beta marker table exists (beta databases are not launch targets).
//
// Dates: puzzle N gets START_DATE + (N-1) days, stored at 00:00 UTC, matching
// the daily reset cycle in docs/05-game-rules.md.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(readFileSync(join(here, 'packs', 'launch-30.json'), 'utf8'));

function validate(p) {
  if (!Array.isArray(p) || p.length !== 30) throw new Error('pack must contain exactly 30 puzzles');
  const answers = new Set();
  for (const [i, item] of p.entries()) {
    const label = `puzzle ${i + 1} (${item.answer ?? '?'})`;
    if (!item.title || !item.answer) throw new Error(`${label}: missing title/answer`);
    if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5)
      throw new Error(`${label}: difficulty must be an integer 1-5`);
    if (!Array.isArray(item.clues) || item.clues.length !== 5)
      throw new Error(`${label}: exactly 5 clues required`);
    if (item.clues.some(c => typeof c !== 'string' || !c.trim()))
      throw new Error(`${label}: clues must be non-empty strings`);
    const key = item.answer.trim().toLowerCase();
    if (answers.has(key)) throw new Error(`${label}: duplicate answer`);
    answers.add(key);
    if (item.clues.some(c => c.toLowerCase().includes(key)))
      throw new Error(`${label}: a clue contains the answer text`);
  }
}

const startRaw = process.env.START_DATE;
const apply = process.env.LAUNCH_PACK_APPLY === '1';
validate(pack);

if (!startRaw || !/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) {
  console.log('Validated 30 puzzles. Provide START_DATE=YYYY-MM-DD to plan dates.');
  if (!apply) process.exit(0);
  throw new Error('START_DATE is required when LAUNCH_PACK_APPLY=1');
}
const start = new Date(startRaw + 'T00:00:00Z');
if (Number.isNaN(start.getTime())) throw new Error('invalid START_DATE');
const dates = pack.map((_, i) => new Date(start.getTime() + i * 86400000));

const db = new PrismaClient();
try {
  const betaMarkers = await db.$queryRaw`SELECT to_regclass('public.threadly_beta_target') AS t`;
  if (betaMarkers[0].t) throw new Error('beta marker table present: refusing to seed a beta database');

  const existing = await db.puzzle.findMany({ where: { publishedDate: { in: dates } }, select: { publishedDate: true } });
  const taken = new Set(existing.map(r => r.publishedDate.toISOString().slice(0, 10)));
  const plan = pack.map((item, i) => ({ item, date: dates[i] })).filter(({ date }) => !taken.has(date.toISOString().slice(0, 10)));

  console.log(`pack: ${pack.length} puzzles, start ${startRaw}, ${taken.size} dates already occupied, ${plan.length} to create`);
  if (!apply) {
    for (const { item, date } of plan) console.log(`  DRY ${date.toISOString().slice(0, 10)}  ${item.answer} (d${item.difficulty})`);
    console.log('Dry run only. Re-run with LAUNCH_PACK_APPLY=1 to write.');
    process.exit(0);
  }
  for (const { item, date } of plan) {
    await db.puzzle.create({
      data: {
        title: item.title,
        answer: item.answer.trim().toLowerCase(),
        difficulty: item.difficulty,
        status: 'published',
        publishedDate: date,
        clues: { create: item.clues.map((text, n) => ({ clueOrder: n + 1, clueText: text })) },
      },
    });
    console.log(`  created ${date.toISOString().slice(0, 10)}  ${item.answer}`);
  }
  console.log(`Seeded ${plan.length} puzzles (${taken.size} skipped as already present).`);
} finally {
  await db.$disconnect();
}
