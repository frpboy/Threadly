import { db } from '@/lib/db';

// Values are parameterized; table names are fixed. No caller-selected target or guest ID.
export const deviceStore = {
  async findDevice(hash: string) {
    const rows = await db.$queryRaw<Array<{ guest_id: string; target_id: string; expires_at: Date; revoked: boolean }>>`
      UPDATE threadly_beta_device SET request_count = request_count + 1
      WHERE token_hash = ${hash} AND revoked = false AND expires_at > now() AND request_count < 2000
      RETURNING guest_id, target_id, expires_at, revoked`;
    const r = rows[0];
    return r ? { guestId: r.guest_id, targetId: r.target_id, expiresAt: r.expires_at.getTime(), revoked: r.revoked } : null;
  },
  async consumeInvitationAndCreateDevice(x: { invitationHash: string; tokenHash: string; guestId: string; targetId: string; now: number; expiresAt: number }) {
    return db.$transaction(async tx => {
      // UPDATE's row lock serializes simultaneous redemption. INSERT rollback restores invitation on failure.
      const used = await tx.$executeRaw`
        UPDATE threadly_beta_invitation SET used_at = ${new Date(x.now)}
        WHERE code_hash = ${x.invitationHash} AND target_id = ${x.targetId}
          AND used_at IS NULL AND expires_at > ${new Date(x.now)}`;
      if (used !== 1) return false;
      await tx.$executeRaw`
        INSERT INTO threadly_beta_device (token_hash, invitation_hash, guest_id, target_id, expires_at)
        VALUES (${x.tokenHash}, ${x.invitationHash}, ${x.guestId}, ${x.targetId}, ${new Date(x.expiresAt)})`;
      return true;
    });
  },
};
export async function verifyTarget(targetId: string, expiresAt: number) {
  const rows = await db.$queryRaw<Array<{ target_id: string; synthetic_only: boolean; expires_at: Date }>>`
    SELECT target_id, synthetic_only, expires_at FROM threadly_beta_target WHERE singleton = true`;
  return rows.length === 1 && rows[0].target_id === targetId && rows[0].synthetic_only === true && rows[0].expires_at.getTime() === expiresAt;
}

/** Global target limit, independent of spoofable forwarding/IP headers. No more than 30 enroll attempts/minute. */
export async function allowEnrollment(targetId: string) {
  const rows = await db.$queryRaw<Array<{ enrollment_attempts: number }>>`
    UPDATE threadly_beta_target SET
      enrollment_attempts = CASE WHEN enrollment_window < now() - interval '1 minute' THEN 1 ELSE enrollment_attempts + 1 END,
      enrollment_window = CASE WHEN enrollment_window < now() - interval '1 minute' THEN now() ELSE enrollment_window END
    WHERE target_id = ${targetId} AND (enrollment_attempts < 30 OR enrollment_window < now() - interval '1 minute')
    RETURNING enrollment_attempts`;
  return rows.length === 1;
}

// ---- Store-native open devices (separate tables; the synthetic beta lane is untouched) ----

import { digest, bearer, mintOpenCredential } from './deviceAccess.mjs';
import { randomBytes } from 'node:crypto';

const OPEN_TTL_MS = 90 * 86400000;

export const openDeviceStore = {
  /** Validate a presented credential; rolling request counter, hard cap like the beta lane. */
  async findOpenDevice(header: string) {
    const token = bearer(header);
    if (!token) return null;
    const rows = await db.$queryRaw<Array<{ guest_id: string; expires_at: Date }>>`
      UPDATE threadly_open_device SET request_count = request_count + 1
      WHERE token_hash = ${digest(token)} AND revoked = false AND expires_at > now() AND request_count < 2000
      RETURNING guest_id, expires_at`;
    const r = rows[0];
    return r ? { guestId: r.guest_id, expiresAt: r.expires_at.getTime() } : null;
  },
  /** Global, IP-independent rate limit: max 30 open enrollments per minute. */
  async allowOpenEnrollment() {
    const rows = await db.$queryRaw<Array<{ n: number }>>`
      UPDATE threadly_open_enrollment SET
        enrollment_attempts = CASE WHEN enrollment_window < now() - interval '1 minute' THEN 1 ELSE enrollment_attempts + 1 END,
        enrollment_window = CASE WHEN enrollment_window < now() - interval '1 minute' THEN now() ELSE enrollment_window END
      WHERE singleton = true AND (enrollment_attempts < 30 OR enrollment_window < now() - interval '1 minute')
      RETURNING enrollment_attempts AS n`;
    return rows.length === 1;
  },
  async createOpenDevice(now = Date.now(), random = randomBytes) {
    const { token, guestId, expiresAt } = mintOpenCredential(random, now, OPEN_TTL_MS);
    await db.$executeRaw`
      INSERT INTO threadly_open_device (token_hash, guest_id, expires_at)
      VALUES (${digest(token)}, ${guestId}, ${new Date(expiresAt)})`;
    return { token, guestId, expiresAt };
  },
  /** Deletion proof for native players: the live credential revokes itself and names its identity. */
  async revokeOpenDevice(header: string) {
    const token = bearer(header);
    if (!token) return null;
    const rows = await db.$queryRaw<Array<{ guest_id: string }>>`
      UPDATE threadly_open_device SET revoked = true
      WHERE token_hash = ${digest(token)} AND revoked = false
      RETURNING guest_id`;
    return rows[0]?.guest_id ?? null;
  },
};

/** Delete every server-side row for a guest identity. Returns per-table counts for the receipt. */
export async function deleteGuestData(guestId: string) {
  return db.$transaction(async tx => {
    const guesses = await tx.$executeRaw`DELETE FROM guesses WHERE guest_id = ${guestId}`;
    const streaks = await tx.$executeRaw`DELETE FROM streaks WHERE guest_id = ${guestId}`;
    const stats = await tx.$executeRaw`DELETE FROM stats WHERE guest_id = ${guestId}`;
    const leaderboard = await tx.$executeRaw`DELETE FROM leaderboard_entries WHERE guest_id = ${guestId}`;
    return { guesses, streaks, stats, leaderboard };
  });
}
