import { scrubHandledApiEvent, stripHandledApiEventAttachments } from "./apiErrorCapture";

/**
 * Privacy boundary for every OTHER error event Sentry would send: uncaught
 * exceptions, unhandled rejections, and explicit capture calls outside the
 * handled-API path. Raw exception messages and stacks can carry SQL,
 * connection strings, tokens, emails or user content, and scope data
 * (breadcrumbs, request, user, tags, contexts, extras) can carry URLs and
 * identity. Every such event is reduced to one fixed generic shape so
 * failures stay countable without any of that content leaving the process.
 *
 * Trade-off, recorded deliberately: error events no longer carry stacks,
 * routes or release metadata, so Sentry issues lose debugging actionability
 * (they answer "something failed, N times" only). Handled API-route errors
 * keep their separately reviewed generic-but-route-tagged shape.
 */

export const GENERIC_ERROR_MESSAGE =
  "Threadly web error (details intentionally withheld)";

const EVENT_ID_PATTERN = /^[0-9a-f]{32}$/;
const MAX_TIMESTAMP_SKEW_SECONDS = 300;

function sanitizeTimestamp(value: unknown): number {
  const now = Date.now() / 1000;
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(now - value) <= MAX_TIMESTAMP_SKEW_SECONDS
  ) {
    return value;
  }
  return now;
}

export function containGenericErrorEvent(event: any, hint?: any): any {
  // beforeSend cannot remove attachments through the returned event; the
  // hint list has to be emptied. Applies to every event on this path, not
  // only tagged handled errors.
  if (hint && Array.isArray(hint.attachments)) hint.attachments.length = 0;
  const contained: Record<string, unknown> = {
    level: "error",
    platform:
      typeof event?.platform === "string" && /^[a-z]+$/.test(event.platform)
        ? event.platform
        : "javascript",
    timestamp: sanitizeTimestamp(event?.timestamp),
    exception: { values: [{ type: "Error", value: GENERIC_ERROR_MESSAGE }] },
    // One fixed fingerprint: all contained errors group into a single issue
    // and stay countable without any distinguishing content.
    fingerprint: ["web-generic-error"],
  };
  // Keep the SDK's event id only when it has the expected 32-hex shape, so
  // the event remains referencable; anything else is dropped.
  if (typeof event?.event_id === "string" && EVENT_ID_PATTERN.test(event.event_id)) {
    contained.event_id = event.event_id;
  }
  return contained;
}

/**
 * beforeSend wiring for the server/edge configs: handled API errors keep
 * their reviewed generic-but-route-tagged shape; every other event gets the
 * full generic shape above.
 */
export function applyWebErrorBoundary(event: any, hint?: any): any {
  stripHandledApiEventAttachments(event, hint);
  const handled = scrubHandledApiEvent(event);
  if (handled !== event) return handled;
  return containGenericErrorEvent(event, hint);
}
