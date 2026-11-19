import * as Sentry from "@sentry/nextjs";
import { containClientBreadcrumb, containTransactionEvent } from "./services/sentryTransactionPrivacy";
import { containGenericErrorEvent } from "./services/sentryGenericErrorBoundary";
import { finalTransportFactory } from "./services/sentryFinalTransport";

Sentry.init({
  dsn: "https://dac50025155ca8a1470c431638516821@o4510460282601472.ingest.us.sentry.io/4511569401675776",

  // Do not attach IP addresses, headers, cookies or user context: set
  // sendDefaultPii false explicitly rather than relying on SDK defaults
  // across upgrades.
  sendDefaultPii: false,

  // Privacy containment: transactions bypass beforeSend and carry raw page
  // URLs including query strings. Tracing stays at 0 until the
  // transaction/span data boundary is qualified; any re-enable must keep the
  // beforeSendTransaction hook below and go through privacy review.
  tracesSampleRate: 0,

  // Setting this option to true will print useful information to the console when Sentry is initialized
  debug: false,

  // Final wire boundary: every envelope is reconstructed (constant event
  // shape, fresh headers), non-event items dropped, rate-limited, and
  // dropped-not-queued when busy. Nothing else leaves the process.
  transport: finalTransportFactory,

  // Drop DOM-interaction (ui.click/ui.input carry clicked-element text) and
  // console breadcrumbs; same privacy class as the user-interaction
  // breadcrumbs disabled in the Android build.
  beforeBreadcrumb(breadcrumb) {
    return containClientBreadcrumb(breadcrumb);
  },

  // Error-event privacy boundary: every client error event is reduced to
  // the fixed generic shape (no stacks, raw messages, scope or identity).
  beforeSend(event, hint) {
    return containGenericErrorEvent(event, hint);
  },

  // Strip query/fragment from transaction request URLs.
  beforeSendTransaction(event) {
    return containTransactionEvent(event);
  },
});

// Session Replay is intentionally NOT configured. Its recording integration
// must never be added without a privacy review of its DOM capture boundary.

// Navigation-transition tracking intentionally not wired: the installed
// @sentry/nextjs 8.55.x does not export captureRouterTransitionStart, and
// with tracesSampleRate 0 there are no navigation transactions to track.
