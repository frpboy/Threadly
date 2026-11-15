/**
 * Identity-based provenance for handled-API-error events.
 *
 * The generic boundary may label an event with its API route only when the
 * event provably came from captureHandledApiError. Comparing exception
 * MESSAGE text is not proof: a remote-derived thrown error could echo the
 * constant string. Object identity cannot be forged by remote input, so the
 * marker Error object created inside captureHandledApiError is registered
 * here and looked up by reference at the boundary.
 */

export const HANDLED_API_ERROR_TAG = "handled_api_error";
export const GENERIC_HANDLED_API_ERROR_MESSAGE =
  "Handled API route failure (details intentionally withheld)";

// The exact route constants used at captureHandledApiError call sites.
// A route outside this set is never emitted.
const TRUSTED_ROUTE_CODES = new Set([
  "guess",
  "clue",
  "leaderboard",
  "beta/enroll",
  "admin/publish",
  "admin/generate-ai",
  "admin/puzzles",
  "archive/[id]",
  "archive",
  "progress",
  "daily",
]);

const handledRoutes = new WeakMap<object, string>();

export function isTrustedRouteCode(route: unknown): route is string {
  return typeof route === "string" && TRUSTED_ROUTE_CODES.has(route);
}

export function registerHandledRouteMarker(marker: unknown, route: string): void {
  if (
    marker !== null &&
    (typeof marker === "object" || typeof marker === "function") &&
    isTrustedRouteCode(route)
  ) {
    handledRoutes.set(marker as object, route);
  }
}

/** Route for a proven marker object, else undefined. */
export function trustedRouteForException(exception: unknown): string | undefined {
  if (
    exception !== null &&
    (typeof exception === "object" || typeof exception === "function")
  ) {
    return handledRoutes.get(exception as object);
  }
  return undefined;
}
