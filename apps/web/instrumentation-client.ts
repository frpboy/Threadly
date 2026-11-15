import * as Sentry from "@sentry/nextjs";
import { containClientBreadcrumb, containTransactionEvent } from "./services/sentryTransactionPrivacy";

Sentry.init({
  dsn: "https://dac50025155ca8a1470c431638516821@o4510460282601472.ingest.us.sentry.io/4511569401675776",

  // Never attach IP addresses, headers, cookies or user context. Set
  // explicitly rather than relying on the SDK default across upgrades.
  sendDefaultPii: false,

  // Privacy containment: transactions bypass beforeSend and carry raw page
  // URLs including query strings. Tracing stays at 0 until the
  // transaction/span data boundary is qualified; any re-enable must keep the
  // beforeSendTransaction hook below and go through privacy review.
  tracesSampleRate: 0,

  // Setting this option to true will print useful information to the console when Sentry is initialized
  debug: false,

  // Drop DOM-interaction (ui.click/ui.input carry clicked-element text) and
  // console breadcrumbs; same privacy class as the user-interaction
  // breadcrumbs disabled in the Android build.
  beforeBreadcrumb(breadcrumb) {
    return containClientBreadcrumb(breadcrumb);
  },

  // Strip query/fragment from transaction request URLs.
  beforeSendTransaction(event) {
    return containTransactionEvent(event);
  },
});

// Session Replay is intentionally NOT configured. Its recording integration
// must never be added without a privacy review of its DOM capture boundary.

/**
 * Track App Router navigation transitions in Sentry.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
