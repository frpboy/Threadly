import * as Sentry from "@sentry/nextjs";
import { applyWebErrorBoundary } from "./services/sentryGenericErrorBoundary";
import { finalTransportFactory } from "./services/sentryFinalTransport";
import { containTransactionEvent } from "./services/sentryTransactionPrivacy";

Sentry.init({
  // The isolated native beta must not send device credentials or synthetic activity to production telemetry.
  enabled: process.env.THREADLY_NATIVE_BETA === undefined,
  dsn: "https://dac50025155ca8a1470c431638516821@o4510460282601472.ingest.us.sentry.io/4511569401675776",

  // Do not attach IP addresses, headers, cookies or user context: set
  // sendDefaultPii false explicitly rather than relying on SDK defaults
  // across upgrades.
  sendDefaultPii: false,

  // Privacy containment: transactions bypass beforeSend and carry raw request
  // URLs including query strings (NextAuth OAuth callback codes). Tracing
  // stays at 0 until the transaction/span data boundary is qualified; any
  // re-enable must keep the beforeSendTransaction hook below in place and go
  // through privacy review.
  tracesSampleRate: 0,

  // Setting this option to true will print useful information to the console when Sentry is initialized
  debug: false,

  // Final wire boundary: every envelope is reconstructed (constant event
  // shape, fresh headers), non-event items dropped, rate-limited, and
  // dropped-not-queued when busy. Nothing else leaves the process.
  transport: finalTransportFactory,

  // Error-event privacy boundary: handled-API-error events keep their
  // reviewed generic route-tagged shape; every other error event is reduced
  // to the fixed generic shape (no stacks, raw messages, scope or identity).
  beforeSend(event, hint) {
    return applyWebErrorBoundary(event, hint);
  },

  // Transactions: drop /api/auth/* entirely (OAuth codes in query strings)
  // and strip query/fragment from every remaining request URL.
  beforeSendTransaction(event) {
    return containTransactionEvent(event);
  },
});
