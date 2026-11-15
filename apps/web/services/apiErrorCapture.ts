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
