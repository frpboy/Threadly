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
