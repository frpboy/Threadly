import { GENERIC_HANDLED_API_ERROR_MESSAGE } from "./apiErrorCapture";

/**
 * Final privacy boundary for every Sentry error event: uncaught exceptions,
 * unhandled rejections, explicit capture calls and handled API failures all
 * leave the process as ONE constant shape built from fresh values only.
 * Nothing is copied from the incoming event: raw messages and stacks can
 * carry SQL, connection strings, tokens or user content; scope data
 * (breadcrumbs, request, headers, user, tags, contexts, extras, release,
 * modules) can carry URLs and identity; and event-level fields like id,
 * timestamp, platform, logger or fingerprint are attacker-influenceable
 * through thrown-error content and settable scope, so none are trusted.
 *
 * The only variable content is an optional route label, and only when BOTH:
 *  - provenance is ours: the event's original exception IS the constant
 *    marker Error emitted by captureHandledApiError (remote input cannot set
 *    hint.originalException; only in-process code passes exceptions), and
 *  - the route code is one of the finite call-site constants below.
 * Incoming tags alone are never trusted: any event can carry them.
 *
 * Trade-off, recorded deliberately: error events answer "something failed,
 * N times (on route R)" only - no stacks or debugging context.
 */

export const GENERIC_ERROR_MESSAGE =
  "Threadly web error (details intentionally withheld)";

// The exact route constants used at captureHandledApiError call sites.
// A route not in this set is dropped, never passed through.
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

function freshEventId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

function finalizeErrorEvent(
  event: any,
  hint: any,
  platform: "node" | "javascript"
): any {
  // beforeSend cannot remove attachments through the returned event; the
  // hint list has to be emptied. Applies to every event, always.
  if (hint && Array.isArray(hint.attachments)) hint.attachments.length = 0;

  const contained: Record<string, unknown> = {
    // Fresh id and clock: nothing carried over from the incoming event.
    event_id: freshEventId(),
    // Platform comes from the calling config (our code), not the event.
    platform,
    level: "error",
    timestamp: Date.now() / 1000,
    exception: { values: [{ type: "Error", value: GENERIC_ERROR_MESSAGE }] },
  };

  const route = event?.tags?.api_route;
  if (
    hint?.originalException?.message === GENERIC_HANDLED_API_ERROR_MESSAGE &&
    typeof route === "string" &&
    TRUSTED_ROUTE_CODES.has(route)
  ) {
    contained.tags = { handled_api_error: "true", api_route: route };
    contained.fingerprint = ["handled-api-error", route];
  } else {
    contained.fingerprint = ["web-generic-error"];
  }
  return contained;
}

/** beforeSend wiring for the server/edge configs. */
export function applyWebErrorBoundary(event: any, hint?: any): any {
  return finalizeErrorEvent(event, hint, "node");
}

/** beforeSend wiring for the client (browser) config. */
export function containGenericErrorEvent(event: any, hint?: any): any {
  return finalizeErrorEvent(event, hint, "javascript");
}
