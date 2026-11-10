import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { prismaUnitOfWork } from '@/services/prismaAttemptStore';
import type { RunInTransaction } from '@/services/guessTransaction';

export class RequestConflict extends Error {}
export function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
/** Cache the exact scoring result atomically with guess + award; lost responses may retry the SAME ID. */
export function betaTransaction(guestId: string, requestId: string, puzzleId: string, guess: string): RunInTransaction {
  const payload = createHash('sha256').update(JSON.stringify([puzzleId, guess.trim()])).digest('hex');
  return async <T>(fn: Parameters<RunInTransaction>[0]): Promise<T> => db.$transaction(async tx => {
    // Serialize all logical requests for this player, not just one request ID.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`threadly:beta-request:${guestId}`}, 0))`;
    const prior = await tx.$queryRaw<Array<{ payload_hash: string; result: unknown }>>`
      SELECT payload_hash, result FROM threadly_beta_request WHERE guest_id = ${guestId} AND request_id = ${requestId}::uuid`;
    if (prior.length) {
      if (prior[0].payload_hash !== payload) throw new RequestConflict('Request ID reused with different contents');
      return prior[0].result as T;
    }
    const result = await fn(prismaUnitOfWork(tx));
    const encoded = JSON.stringify(result);
    await tx.$executeRaw`
      INSERT INTO threadly_beta_request (guest_id, request_id, payload_hash, result)
      VALUES (${guestId}, ${requestId}::uuid, ${payload}, ${encoded}::jsonb)`;
    return JSON.parse(encoded) as T;
  }, { timeout: 15000 });
}
