// Deterministic regression for the pre-lock authorization race (review round 2):
// /api/guess authenticates an open device BEFORE its serializing transaction.
// These tests drive the REAL migration schema and the REAL liveness SQL through
// PGlite in both serial orderings and assert the invariant: after a confirmed
// deletion, zero gameplay/receipt rows can exist for the identity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { OPEN_DEVICE_ALIVE_SQL, openDeviceAlive, type UnsafeQueryable } from "../nativeBeta/openDeviceRevalidation.ts";

const schema = readFileSync(new URL("../../prisma/drafts/open-device.up.sql", import.meta.url), "utf8");

const GUEST = "dev-0123456789abcdef0123456789abcdef0123456789abcdef";

async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE guesses (id text primary key, user_id text, guest_id text, puzzle_id text not null,
      guess_text text not null, is_correct boolean not null default false, clue_number int not null,
      created_at timestamp(3) not null default now());
    CREATE TABLE streaks (guest_id text primary key, current_streak int not null default 0);
    CREATE TABLE stats (guest_id text primary key, games_played int not null default 0);
    CREATE TABLE leaderboard_entries (id text primary key, guest_id text, username text, score int not null default 0);`);
  await db.exec(schema); // the REAL open-device migration (threadly_open_device + receipt + enrollment)
  return db;
}

/** Adapt a PGlite (transaction) connection to the UnsafeQueryable shape the route's tx provides. */
function adapt(q: { query<T>(sql: string, params?: unknown[]): Promise<{ rows: T }> }): UnsafeQueryable {
  return { async $queryRawUnsafe<T>(sql: string, ...values: unknown[]) { return (await q.query<T>(sql, values)).rows as T; } };
}

async function enroll(db: PGlite, guestId = GUEST) {
  await db.query(
    "INSERT INTO threadly_open_device (token_hash, guest_id, expires_at) VALUES ($1, $2, now() + interval '90 days')",
    ["hash-" + guestId, guestId]);
}

/** What deleteIdentityData does, in the same order, against the same tables. */
async function deleteIdentity(db: PGlite, guestId: string) {
  await db.query("DELETE FROM guesses WHERE guest_id=$1", [guestId]);
  await db.query("DELETE FROM streaks WHERE guest_id=$1", [guestId]);
  await db.query("DELETE FROM stats WHERE guest_id=$1", [guestId]);
  await db.query("DELETE FROM leaderboard_entries WHERE guest_id=$1", [guestId]);
  await db.query("DELETE FROM threadly_guess_receipt WHERE guest_id=$1", [guestId]);
  await db.query("DELETE FROM threadly_open_device WHERE guest_id=$1", [guestId]);
}

/** The guess transaction's write set, gated by the in-transaction liveness check (as betaTransaction now does). */
async function lockedGuess(db: PGlite, guestId: string, winning: boolean) {
  return db.transaction(async (tx) => {
    if (!(await openDeviceAlive(adapt(tx), guestId))) return "aborted-401";
    await tx.query("INSERT INTO guesses (id, guest_id, puzzle_id, guess_text, is_correct, clue_number) VALUES ($1,$2,'p','guess',$3,1)",
      ["g-" + Math.random(), guestId, winning]);
    await tx.query(
      "INSERT INTO threadly_guess_receipt (guest_id, request_id, payload_hash, result) VALUES ($1, gen_random_uuid(), 'h', '{}'::jsonb)",
      [guestId]);
    if (winning) {
      await tx.query("INSERT INTO streaks (guest_id, current_streak) VALUES ($1,1)", [guestId]);
      await tx.query("INSERT INTO stats (guest_id, games_played) VALUES ($1,1)", [guestId]);
      await tx.query("INSERT INTO leaderboard_entries (id, guest_id, username, score) VALUES ($1,$2,$3,100)",
        ["l-" + Math.random(), guestId, "Guest_" + guestId]);
    }
    return "committed-200";
  });
}

const totalRows = async (db: PGlite, guestId: string) =>
  Number((await db.query<any>(
    `SELECT (SELECT count(*) FROM guesses WHERE guest_id=$1)
          + (SELECT count(*) FROM streaks WHERE guest_id=$1)
          + (SELECT count(*) FROM stats WHERE guest_id=$1)
          + (SELECT count(*) FROM leaderboard_entries WHERE guest_id=$1)
          + (SELECT count(*) FROM threadly_guess_receipt WHERE guest_id=$1) AS n`,
    [guestId])).rows[0].n); // PGlite binds by distinct placeholder: one $1, one value

test("liveness SQL: alive when the row exists and is unrevoked, dead otherwise", async () => {
  const db = await freshDb();
  await enroll(db);
  assert.equal(await openDeviceAlive(adapt(db), GUEST), true);
  await db.query("UPDATE threadly_open_device SET revoked = true WHERE guest_id=$1", [GUEST]);
  assert.equal(await openDeviceAlive(adapt(db), GUEST), false);
  await db.query("UPDATE threadly_open_device SET revoked = false WHERE guest_id=$1", [GUEST]);
  await db.query("DELETE FROM threadly_open_device WHERE guest_id=$1", [GUEST]);
  assert.equal(await openDeviceAlive(adapt(db), GUEST), false);
});

for (const winning of [true, false]) {
  test(`delete-first ordering (${winning ? "winning" : "losing"} guess): the in-flight guess aborts 401 and strands nothing`, async () => {
    const db = await freshDb();
    await enroll(db);
    // credential authenticated here (row existed) ... deletion commits first ...
    await deleteIdentity(db, GUEST);
    // ... then the already-authorized guess transaction reaches its lock.
    assert.equal(await lockedGuess(db, GUEST, winning), "aborted-401");
    assert.equal(await totalRows(db, GUEST), 0);
  });

  test(`guess-first ordering (${winning ? "winning" : "losing"} guess): deletion removes the committed rows`, async () => {
    const db = await freshDb();
    await enroll(db);
    assert.equal(await lockedGuess(db, GUEST, winning), "committed-200");
    await deleteIdentity(db, GUEST);
    assert.equal(await totalRows(db, GUEST), 0);
  });
}

test("without the in-transaction check the reviewer's defect reproduces (documents what the gate prevents)", async () => {
  const db = await freshDb();
  await enroll(db);
  await deleteIdentity(db, GUEST);
  // ungated write, as r2 behaved: commits orphaned rows for a deleted identity
  await db.query("INSERT INTO guesses (id, guest_id, puzzle_id, guess_text, is_correct, clue_number) VALUES ('orphan',$1,'p','guess',true,1)", [GUEST]);
  assert.equal(await totalRows(db, GUEST), 1); // stranded, no device row, no purge path
});
