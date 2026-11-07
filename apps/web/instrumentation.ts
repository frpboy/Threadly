import * as Sentry from "@sentry/nextjs";

/**
 * Load Sentry's server configuration in each Next.js server runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Capture errors surfaced by Next.js request and Server Component handling.
 */
export const onRequestError = Sentry.captureRequestError;
