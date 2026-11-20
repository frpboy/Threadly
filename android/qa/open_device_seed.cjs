// Disposable runner DB only. Seeds lifecycle fixtures for open-device UI qualification:
// one EXPIRED device (gameplay dead, deletion still allowed) and one request-CAPPED device,
// each with one stored guess. Fixed test tokens, stored as sha256 only.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { guardedUrl } = require('./real_db_gate.cjs');
const puzzle = '00000000-0000-4000-8000-000000000010';
const fixtures = [
  { token: 'E'.repeat(43), guestId: 'dev-' + 'e'.repeat(48), expired: true, capped: false },
  { token: 'C'.repeat(43), guestId: 'dev-' + 'c'.repeat(48), expired: false, capped: true },
];
async function main() {
  guardedUrl(process.env.DATABASE_URL, process.env.THREADLY_GATE_PASSWORD);
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  try {
    for (const f of fixtures) {
      const hash = crypto.createHash('sha256').update(f.token, 'utf8').digest('hex');
      const n = await db.$executeRawUnsafe(
        `INSERT INTO threadly_open_device (token_hash, guest_id, expires_at, request_count)
         VALUES ($1, $2, $3, $4) ON CONFLICT (token_hash) DO NOTHING`,
        hash, f.guestId,
        f.expired ? new Date(Date.now() - 86400000) : new Date(Date.now() + 90 * 86400000),
        f.capped ? 2000 : 0);
      assert.equal(n, 1);
      await db.guess.create({ data: { puzzleId: puzzle, guestId: f.guestId, playerKey: 'g:' + f.guestId, guessText: 'wrong', isCorrect: false, clueNumber: 1 } });
    }
    console.log('PASS open-device lifecycle fixtures seeded (expired + capped, one guess each)');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error('Local DB assertion failed: ' + e.name); process.exitCode = 1; });
