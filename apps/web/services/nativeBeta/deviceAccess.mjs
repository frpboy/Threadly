import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
const credential = /^[A-Za-z0-9_-]{43}$/;
export function bearer(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return credential.test(token) ? token : null;
}
export function allowedConfig(config, now) {
  return config.enabled === true && config.syntheticOnly === true &&
    typeof config.targetId === 'string' && /^threadly-native-beta-[a-z0-9-]{1,48}$/.test(config.targetId) &&
    Number.isSafeInteger(config.expiresAt) && config.expiresAt > now &&
    config.expiresAt - now <= 7 * 86400000;
}
/** Explicitly isolated beta only. No fallback to a caller's guest ID or account session. */
export async function authenticate(header, { store, config, now = Date.now() }) {
  if (!allowedConfig(config, now)) return null;
  const token = bearer(header);
  if (!token) return null;
  const device = await store.findDevice(digest(token));
  if (!device || device.revoked || device.expiresAt <= now || device.targetId !== config.targetId) return null;
  return { guestId: device.guestId, expiresAt: Math.min(device.expiresAt, config.expiresAt) };
}
/** Caller receives one device-scoped credential, never a reusable enrollment/admin secret. */
export async function enroll(code, { store, config, now = Date.now(), random = randomBytes }) {
  if (!allowedConfig(config, now) || typeof code !== 'string' || !credential.test(code)) return null;
  const token = random(32).toString('base64url');
  const guestId = 'beta-' + random(24).toString('hex');
  const expiresAt = config.expiresAt;
  // This MUST consume the invitation and create the device in ONE DB transaction.
  // A failed/ambiguous response cannot redeem again; operator revokes/reissues instead.
  const accepted = await store.consumeInvitationAndCreateDevice({
    invitationHash: digest(code), tokenHash: digest(token), guestId,
    targetId: config.targetId, now, expiresAt,
  });
  return accepted ? { token, expiresAt } : null;
}
/** Constant-time marker check for the independently provisioned test target. */
export function sameMarker(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
