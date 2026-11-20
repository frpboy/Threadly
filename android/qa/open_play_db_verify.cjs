// Disposable runner DB only. Combined poststate: the four legacy loopback flows AND the
// open-play lifecycle flows, on the actual schema + open-device migration.
const assert = require('node:assert/strict');
const { guardedUrl } = require('./real_db_gate.cjs');
const puzzle = '00000000-0000-4000-8000-000000000010';
const guests = { resume: 'real-gate-resume', solve: 'real-gate-solve', exhausted: 'real-gate-exhausted' };
async function main() {
  guardedUrl(process.env.DATABASE_URL, process.env.THREADLY_GATE_PASSWORD);
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  try {
    // Legacy flows, unchanged.
    assert.equal(await db.puzzle.count(), 4); assert.equal(await db.user.count(), 0);
    for (const [kind, guestId] of Object.entries(guests)) {
      const rows = await db.guess.findMany({ where: { puzzleId: puzzle, guestId }, orderBy: { clueNumber: 'asc' } });
      assert.equal(rows.length, kind === 'resume' ? 1 : kind === 'exhausted' ? 5 : 2);
      assert(rows.every(r => r.playerKey === 'g:' + guestId));
    }
    assert.equal(await db.stats.count(), 1); assert.equal(await db.leaderboardEntry.count(), 1);
    assert.equal(await db.guess.count({ where: { guestId: 'malformed-probe' } }), 0);
    // Open-play flows: test A's device survives with one wrong guess + one receipt;
    // the activity test's device survives with no guesses. Deleted identities retain nothing.
    const devices = await db.$queryRawUnsafe('SELECT guest_id FROM threadly_open_device');
    assert.equal(devices.length, 2, JSON.stringify(devices));
    assert(!devices.some(d => d.guest_id === 'dev-' + 'e'.repeat(48)), 'expired fixture must be deleted');
    assert(!devices.some(d => d.guest_id === 'dev-' + 'c'.repeat(48)), 'capped fixture must be deleted');
    assert.equal(await db.guess.count({ where: { guestId: { startsWith: 'dev-' } } }), 1);
    assert.equal((await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM threadly_guess_receipt'))[0].n, 1);
    assert.equal(await db.guess.count(), 9);
    console.log('PASS real PostgreSQL poststate: legacy flows intact; open identities deleted completely; survivors exactly as expected');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error('Local DB assertion failed: ' + e.name); process.exitCode = 1; });
