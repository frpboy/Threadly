import { createTransport } from "@sentry/core";
import type {
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
  BaseTransportOptions,
} from "@sentry/core";
import { GENERIC_ERROR_MESSAGE } from "./sentryGenericErrorBoundary";

/**
 * Final transport boundary: the last thing every envelope passes through
 * before any byte leaves the process. beforeSend shapes the event payload,
 * but the SDK adds metadata after beforeSend and builds the rest of the
 * envelope (envelope headers, sessions, attachments, client reports,
 * transactions if tracing is ever re-enabled). This transport therefore
 * does not trust the incoming envelope at all:
 *
 *  - RECONSTRUCTION: event payloads are rebuilt from constants (fresh event
 *    id, fresh timestamp, constant message/fingerprint). The only values
 *    carried over are a 'node'/'javascript' platform tag and a route label
 *    under an exact structural match against a finite trusted route set.
 *  - DROP OTHERS: every non-event envelope item (attachments, sessions,
 *    replays, profiles, client reports, transactions) is dropped.
 *  - FRESH HEADERS: envelope headers are rebuilt (fresh event_id, fresh
 *    sent_at); the SDK's trace header (dynamic sampling context can carry
 *    request/user data) is never forwarded.
 *  - RATE: at most RATE_MAX events per process per minute; excess dropped.
 *  - DROP BUSY: at most MAX_IN_FLIGHT sends in flight; beyond that the
 *    event is dropped, never queued or retried.
 *
 * Dropped work resolves as a success result so the SDK never retries; the
 * underlying fetch transport still honors Sentry's own rate-limit headers.
 */

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
// Process-wide sliding window, shared by every transport instance: at most
// RATE_MAX events admitted in ANY trailing RATE_WINDOW_MS span (no burst
// at a fixed window boundary).
const admittedTimestamps: number[] = [];
/** Test seam: reset the process-wide rate window. */
export function resetFinalTransportRateForTest(): void {
  admittedTimestamps.length = 0;
}

function admitEvents(count: number): boolean {
  const now = Date.now();
  while (admittedTimestamps.length > 0 && now - admittedTimestamps[0] >= RATE_WINDOW_MS) {
    admittedTimestamps.shift();
  }
  if (admittedTimestamps.length + count > RATE_MAX) return false;
  for (let i = 0; i < count; i++) admittedTimestamps.push(now);
  return true;
}
const MAX_IN_FLIGHT = 1;
// Hard upper bound for one HTTP attempt: a hung connection is aborted and
// the event dropped, never left pending. Keeps the busy gate bounded.
const REQUEST_DEADLINE_MS = 10_000;

type MakeRequest = (request: TransportRequest) => Promise<TransportMakeRequestResponse>;

function freshEventId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

function reconstructEventPayload(payload: any): Record<string, unknown> | null {
  const p = typeof payload === "string" ? safeParse(payload) : payload;
  if (!p || typeof p !== "object") return null;
  // Nothing structural is carried over - not even the handled-route label.
  // The transport cannot verify the WeakMap identity provenance that
  // beforeSend used, and a structural match here could be forged by any
  // event reaching this layer, so the optional label is dropped at the
  // final boundary (finite classification risk removed by removal).
  return {
    event_id: freshEventId(),
    platform: p.platform === "node" ? "node" : "javascript",
    level: "error",
    timestamp: Date.now() / 1000,
    exception: { values: [{ type: "Error", value: GENERIC_ERROR_MESSAGE }] },
    fingerprint: ["web-generic-error"],
  };
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Rebuild an envelope to exactly ONE constant event item; null when none
 * remain. The envelope header event_id matches the payload event_id, as the
 * envelope protocol requires; every other item and any further event items
 * are dropped.
 */
export function rebuildEnvelope(envelope: any): { envelope: any; count: number } | null {
  const [, rawItems] = Array.isArray(envelope) ? envelope : [];
  if (!Array.isArray(rawItems)) return null;
  for (const item of rawItems) {
    if (!Array.isArray(item)) continue;
    const [itemHeaders, payload] = item;
    if (!itemHeaders || itemHeaders.type !== "event") continue; // drop everything else
    const rebuilt = reconstructEventPayload(payload);
    if (!rebuilt) continue;
    const headers = {
      event_id: rebuilt.event_id, // header and payload ids must match
      sent_at: new Date().toISOString(),
    };
    return { envelope: [headers, [[{ type: "event" }, rebuilt]]], count: 1 };
  }
  return null;
}

async function defaultMakeRequest(
  options: BaseTransportOptions,
  request: TransportRequest,
  deadlineMs: number = REQUEST_DEADLINE_MS
): Promise<TransportMakeRequestResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const response = await fetch(options.url, {
      method: "POST",
      body: request.body as BodyInit,
      // Fixed network posture: only the envelope content type, never the
      // SDK's forwarded header set; no referrer; never follow redirects (a
      // redirect would carry the envelope to a different host).
      headers: { "content-type": "application/x-sentry-envelope" },
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
    });
    const result: TransportMakeRequestResponse = {
      statusCode: response.status,
      headers: {
        "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits"),
        "retry-after": response.headers.get("retry-after"),
      },
    };
    // Drain/cancel the body so the socket is released deterministically.
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // already consumed or closed
      }
    }
    return result;
  } catch {
    // Aborted at the deadline or connection failed: the event is dropped
    // (a failed status the SDK records), never retried by us.
    return { statusCode: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Transport factory: pass as `transport` in Sentry.init for all web configs. */
export function finalTransportFactory(options: BaseTransportOptions): Transport {
  return buildFinalTransport(options, (request) =>
    defaultMakeRequest(options, request, REQUEST_DEADLINE_MS)
  );
}

/**
 * Test seam for the REAL production fetch path: identical wiring to
 * finalTransportFactory, only the deadline is shortened so a hanging HTTP
 * server can be qualified inside a test.
 */
export function finalTransportFactoryRealHttpForTest(deadlineMs: number) {
  return (options: BaseTransportOptions): Transport =>
    buildFinalTransport(options, (request) =>
      defaultMakeRequest(options, request, deadlineMs)
    );
}

/** Test seam: same boundary with an injectable HTTP layer. */
export function finalTransportFactoryWith(makeRequest: MakeRequest) {
  return (options: BaseTransportOptions): Transport =>
    buildFinalTransport(options, makeRequest);
}

function buildFinalTransport(options: BaseTransportOptions, makeRequest: MakeRequest): Transport {
  const base = createTransport(options, makeRequest);
  let inFlight = 0;
  return {
    async send(envelope: any): Promise<TransportMakeRequestResponse> {
      const rebuilt = rebuildEnvelope(envelope);
      if (!rebuilt) return { statusCode: 200 }; // nothing sendable
      if (!admitEvents(rebuilt.count)) return { statusCode: 200 }; // rate: dropped
      if (inFlight >= MAX_IN_FLIGHT) return { statusCode: 200 }; // dropped, no queue
      inFlight++;
      try {
        return await base.send(rebuilt.envelope);
      } finally {
        inFlight--;
      }
    },
    async flush(timeout?: number): Promise<boolean> {
      return base.flush(timeout);
    },
  };
}
