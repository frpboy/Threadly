import * as Sentry from "@sentry/nextjs";
import { scrubHandledApiEvent, stripHandledApiEventAttachments } from "./services/apiErrorCapture";

Sentry.init({
  // The isolated native beta must not send device credentials or synthetic activity to production telemetry.
  enabled: process.env.THREADLY_NATIVE_BETA === undefined,
  dsn: "https://dac50025155ca8a1470c431638516821@o4510460282601472.ingest.us.sentry.io/4511569401675776",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console when Sentry is initialized
  debug: false,

  // Handled-API-error events are reduced to a generic allowlisted shape and
  // their envelope attachments dropped; every other event passes through.
  beforeSend(event, hint) {
    stripHandledApiEventAttachments(event, hint);
    return scrubHandledApiEvent(event);
  },
});
