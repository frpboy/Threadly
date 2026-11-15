import {
  GENERIC_HANDLED_API_ERROR_MESSAGE,
  trustedRouteForException,
} from "./sentryHandledMarker";

/**
 * beforeSend privacy boundary for every Sentry error event: uncaught
 * exceptions, unhandled rejections, explicit capture calls and handled API
 * failures all leave this hook as ONE constant shape built from fresh
 * values only. Nothing is copied from the incoming event: raw messages and
 * stacks can carry SQL, connection strings, tokens or user content; scope
 * data (breadcrumbs, request, headers, user, tags, contexts, extras,
 * release, modules) can carry URLs and identity; and event-level fields
 * like id, timestamp, platform, logger or fingerprint are influenceable
 * through thrown-error content and settable scope, so none are trusted.
 *
 * The only variable content is an optional route label, emitted only when
 * the event's original exception is a registered marker object created by
 * captureHandledApiError (identity-based provenance; message text is never
 * used as proof). Incoming tags are never trusted: any event can carry them.
 *
 * This hook is not the final boundary by itself: the SDK adds metadata after
 * beforeSend and builds the rest of the envelope (non-event items, headers).
 * The final wire guarantee lives in sentryFinalTransport, which reconstructs
 * every envelope before anything is sent.
 */

export const GENERIC_ERROR_MESSAGE =
  "Threadly web error (details intentionally withheld)";

function freshEventId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

function finalizeErrorEvent(
  event: any,
  hint: any,
  platform: "node" | "javascript"
): any {
  // beforeSend cannot remove attachments through the returned event; the
  // hint list has to be emptied. Applies to every event, always. The final
  // transport drops attachment envelope items as well, defense in depth.
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

  const route = trustedRouteForException(hint?.originalException);
  if (route) {
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
