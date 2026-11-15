import * as Sentry from "@sentry/nextjs";

/**
 * Privacy-bounded reporting for HANDLED API-route failures.
 *
 * Routes deliberately catch unexpected errors and answer with a generic
 * 500/503. That keeps the failure invisible to Sentry's unhandled-error
 * hooks, so real backend failures (database down, Prisma errors) currently
 * produce no event at all. This helper emits one generic, grouped event per
 * route so such failures are detectable without any raw exception text,
 * request data, user identity or other private context leaving the process.
 * Expected client-error outcomes (400/401/403/404/409) are never reported.
 */

export const HANDLED_API_ERROR_TAG = "handled_api_error";
export const GENERIC_HANDLED_API_ERROR_MESSAGE =
  "Handled API route failure (details intentionally withheld)";

type CaptureLike = (exception: unknown, captureContext?: any) => string;

export function captureHandledApiError(
  route: string,
  _error: unknown,
  capture: CaptureLike = Sentry.captureException
): string {
  // The raw error is deliberately never passed on: its message and stack can
  // carry SQL, connection strings, tokens or user content. Detection only.
  return capture(new Error(GENERIC_HANDLED_API_ERROR_MESSAGE), {
    tags: { [HANDLED_API_ERROR_TAG]: "true", api_route: route },
    fingerprint: ["handled-api-error", route],
  });
}

const ALLOWED_EVENT_KEYS = new Set([
  "event_id",
  "platform",
  "level",
  "timestamp",
  "logger",
  "message",
  "tags",
  "fingerprint",
  // Re-added by the SDK after beforeSend; carries SDK name/version only.
  "sdk",
]);

/**
 * beforeSend boundary for tagged handled-error events: reduces them to a
 * fixed allowlist so late SDK/scope enrichment (request, user, breadcrumbs,
 * contexts, extra, modules, release, environment, exception payloads) cannot
 * ride along. Untagged events pass through unchanged.
 */
export function scrubHandledApiEvent(event: any): any {
  if (!event || event?.tags?.[HANDLED_API_ERROR_TAG] !== "true") return event;
  const scrubbed: Record<string, unknown> = {};
  for (const key of Object.keys(event)) {
    if (ALLOWED_EVENT_KEYS.has(key)) scrubbed[key] = event[key];
  }
  scrubbed.tags = {
    [HANDLED_API_ERROR_TAG]: "true",
    api_route: event.tags.api_route,
  };
  return scrubbed;
}

/**
 * Clears envelope attachments for tagged handled-error events. beforeSend
 * cannot remove attachments through the returned event object, so the hint
 * list is emptied separately. Call from beforeSend in both the server and
 * edge Sentry configs.
 */
export function stripHandledApiEventAttachments(event: any, hint: any): void {
  if (
    event?.tags?.[HANDLED_API_ERROR_TAG] === "true" &&
    hint &&
    Array.isArray(hint.attachments)
  ) {
    hint.attachments.length = 0;
  }
}
