import * as Sentry from "@sentry/nextjs";
import { scrubHandledApiEvent, stripHandledApiEventAttachments } from "./services/apiErrorCapture";
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

  // Handled-API-error events are reduced to a generic allowlisted shape and
  // their envelope attachments dropped; every other event passes through.
  beforeSend(event, hint) {
    stripHandledApiEventAttachments(event, hint);
    return scrubHandledApiEvent(event);
  },

  // Transactions: drop /api/auth/* entirely (OAuth codes in query strings)
  // and strip query/fragment from every remaining request URL.
  beforeSendTransaction(event) {
    return containTransactionEvent(event);
  },
});
