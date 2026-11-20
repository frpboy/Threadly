/**
 * In-transaction liveness check for an open store-native device identity.
 *
 * /api/guess authenticates the device credential BEFORE its serializing
 * transaction starts. A concurrent self-deletion can commit in between. The
 * guess transaction must therefore re-verify, AFTER taking its advisory lock,
 * that the identity still exists; otherwise it would commit guess/award rows
 * for an identity whose device row is already gone (no purge path can reach
 * them, and a winning guess would stay publicly visible on the leaderboard).
 *
 * Kept import-free so node:test can drive the exact same SQL through PGlite.
 */
export const OPEN_DEVICE_ALIVE_SQL =
  'SELECT 1 AS x FROM threadly_open_device WHERE guest_id = $1 AND revoked = false';

/** Structural subset of a Prisma transaction client (also wrappable around PGlite in tests). */
export interface UnsafeQueryable {
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
}

export async function openDeviceAlive(tx: UnsafeQueryable, guestId: string): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<unknown[]>(OPEN_DEVICE_ALIVE_SQL, guestId);
  return rows.length === 1;
}
