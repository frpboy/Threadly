/**
 * Privacy containment for Sentry performance transactions.
 *
 * Transactions bypass `beforeSend`; without this boundary every sampled
 * transaction carries the raw request URL including its query string, and
 * query strings are NOT gated by `sendDefaultPii` (only headers, cookies and
 * IP are). NextAuth OAuth callbacks
 * (/api/auth/callback/<provider>?code=...&state=...) would place single-use
 * authorization codes in Sentry transaction data.
 *
 * While tracesSampleRate is 0 this hook is defense in depth; it is also the
 * reviewed allowlist that must stay in place if tracing is ever re-enabled:
 *   - /api/auth/* transactions are dropped entirely
 *   - query string and fragment are stripped from every remaining request URL
 *
 * Verified against @sentry/nextjs 10.78.0 (package-lock.json): URL capture is
 * unconditional, request body is never captured, and replay is inert unless
 * replayIntegration() is added explicitly.
 */
const AUTH_ROUTE_PREFIX = "/api/auth";

type TransactionRequest = {
  url?: string;
  query_string?: unknown;
  fragment?: unknown;
};

type TransactionEventLike = {
  transaction?: string;
  request?: TransactionRequest;
};

/** Strip scheme and authority from an absolute URL; pass paths through. */
function urlPath(url: string): string {
  const noQuery = url.split(/[?#]/, 1)[0];
  const match = noQuery.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+(\/.*)?$/);
  return match ? match[1] ?? "/" : noQuery;
}

function isAuthPath(path: string): boolean {
  return path === AUTH_ROUTE_PREFIX || path.startsWith(AUTH_ROUTE_PREFIX + "/");
}

/**
 * beforeSendTransaction hook: drop auth-flow transactions outright and strip
 * query/fragment data from all remaining request URLs. Returns null to drop.
 */
export function containTransactionEvent<T extends TransactionEventLike>(event: T): T | null {
  const name = event.transaction ?? "";
  const url = event.request?.url ?? "";
  if (isAuthPath(name) || (url !== "" && isAuthPath(urlPath(url)))) {
    return null;
  }
  if (event.request) {
    if (url.includes("?") || url.includes("#")) {
      event.request.url = url.split(/[?#]/, 1)[0];
    }
    delete event.request.query_string;
    delete event.request.fragment;
  }
  return event;
}

/**
 * beforeBreadcrumb hook for the browser client: drop DOM interaction
 * (ui.click/ui.input, which carry clicked-element text) and console
 * breadcrumbs. Same privacy class as the user-interaction breadcrumbs
 * disabled on Android.
 */
export function containClientBreadcrumb<T extends { category?: string }>(breadcrumb: T): T | null {
  const category = breadcrumb.category ?? "";
  if (category === "console" || category.startsWith("ui.")) {
    return null;
  }
  return breadcrumb;
}
