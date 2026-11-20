/** Reject invalid work before answer matching or database access. No silent truncation. */
export function validPuzzleId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
export function validGuess(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}
export function validGuestId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.length <= 100;
}

/** Server-issued identity namespaces: open store-native devices (dev-*) and legacy beta devices (beta-*). */
const SERVER_ISSUED = /^(dev|beta)-/i;

/**
 * A guest id a caller may CLAIM through public paths (progress, guess, deletion).
 * Server-issued identities are never claimable: they require their live credential,
 * otherwise anyone who learned a player ID could read, play as, or delete that identity.
 */
export function claimableGuestId(value: unknown): value is string {
  return validGuestId(value) && !SERVER_ISSUED.test((value as string).trim());
}
