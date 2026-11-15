import * as Sentry from "@sentry/nextjs";
import {
  HANDLED_API_ERROR_TAG,
  GENERIC_HANDLED_API_ERROR_MESSAGE,
  registerHandledRouteMarker,
} from "./sentryHandledMarker";

// Re-exported so existing imports/tests keep working; the marker module owns them.
export { HANDLED_API_ERROR_TAG, GENERIC_HANDLED_API_ERROR_MESSAGE };

/**
 * Privacy-bounded reporting for HANDLED API-route failures.
 *
 * Routes deliberately catch unexpected errors and answer with a generic
 * 500/503. That keeps the failure invisible to Sentry's unhandled-error
 * hooks, so real backend failures (database down, Prisma errors) would
 * otherwise produce no event at all. This helper emits one generic, grouped
 * event per route so such failures are detectable. The raw error is never
 * passed on: its message and stack can carry SQL, connection strings,
 * tokens or user content. Expected client-error outcomes (400/401/403/404/
 * 409) are never reported.
 *
 * The marker Error object is registered by identity (see
 * sentryHandledMarker): the generic boundary emits the route label only for
 * an event whose original exception IS this object. Tags on the event are
 * hints for the SDK pipeline only; the boundary never trusts them.
 */

type CaptureLike = (exception: unknown, captureContext?: any) => string;

export function captureHandledApiError(
  route: string,
  _error: unknown,
  capture: CaptureLike = Sentry.captureException
): string {
  const marker = new Error(GENERIC_HANDLED_API_ERROR_MESSAGE);
  registerHandledRouteMarker(marker, route);
  return capture(marker, {
    tags: { [HANDLED_API_ERROR_TAG]: "true", api_route: route },
    fingerprint: ["handled-api-error", route],
  });
}
