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
