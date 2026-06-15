import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://dac50025155ca8a1470c431638516821@o4510460282601472.ingest.us.sentry.io/4511569401675776",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console when Sentry is initialized
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample fewer longer sessions in production.
  replaysSessionSampleRate: 0.1,
});
