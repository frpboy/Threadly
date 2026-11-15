import { createTransport } from "@sentry/core";
import type {
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
  BaseTransportOptions,
} from "@sentry/core";
import { GENERIC_ERROR_MESSAGE } from "./sentryGenericErrorBoundary";
import { isTrustedRouteCode } from "./sentryHandledMarker";

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
const MAX_IN_FLIGHT = 1;

type MakeRequest = (request: TransportRequest) => Promise<TransportMakeRequestResponse>;

function freshEventId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

function reconstructEventPayload(payload: any): Record<string, unknown> | null {
  const p = typeof payload === "string" ? safeParse(payload) : payload;
  if (!p || typeof p !== "object") return null;
  const out: Record<string, unknown> = {
    event_id: freshEventId(),
    platform: p.platform === "node" ? "node" : "javascript",
    level: "error",
    timestamp: Date.now() / 1000,
    exception: { values: [{ type: "Error", value: GENERIC_ERROR_MESSAGE }] },
  };
  // Route label survives reconstruction only under an exact structural
  // match: precisely the handled tag pair with a trusted route code and the
  // matching fingerprint, and nothing else in tags.
  const tags = p.tags;
  const fp = p.fingerprint;
  if (
    tags &&
    typeof tags === "object" &&
    Object.keys(tags).length === 2 &&
    tags.handled_api_error === "true" &&
    isTrustedRouteCode(tags.api_route) &&
    Array.isArray(fp) &&
    fp.length === 2 &&
    fp[0] === "handled-api-error" &&
    fp[1] === tags.api_route
  ) {
    out.tags = { handled_api_error: "true", api_route: tags.api_route };
    out.fingerprint = ["handled-api-error", tags.api_route];
  } else {
    out.fingerprint = ["web-generic-error"];
  }
  return out;
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Rebuild an envelope to constant event items only; null when none remain. */
export function rebuildEnvelope(envelope: any): { envelope: any; count: number } | null {
  const items: any[] = [];
  const [, rawItems] = Array.isArray(envelope) ? envelope : [];
  if (!Array.isArray(rawItems)) return null;
  for (const item of rawItems) {
    if (!Array.isArray(item)) continue;
    const [itemHeaders, payload] = item;
    if (!itemHeaders || itemHeaders.type !== "event") continue; // drop everything else
    const rebuilt = reconstructEventPayload(payload);
    if (rebuilt) items.push([{ type: "event" }, rebuilt]);
  }
  if (items.length === 0) return null;
  const headers = { event_id: freshEventId(), sent_at: new Date().toISOString() };
  return { envelope: [headers, items], count: items.length };
}

async function defaultMakeRequest(
  options: BaseTransportOptions,
  request: TransportRequest
): Promise<TransportMakeRequestResponse> {
  const response = await fetch(options.url, {
    method: "POST",
    body: request.body as BodyInit,
    headers: options.headers as HeadersInit | undefined,
  });
  return {
    statusCode: response.status,
    headers: {
      "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits"),
      "retry-after": response.headers.get("retry-after"),
    },
  };
}

/** Transport factory: pass as `transport` in Sentry.init for all web configs. */
export function finalTransportFactory(options: BaseTransportOptions): Transport {
  return buildFinalTransport(options, (request) => defaultMakeRequest(options, request));
}

/** Test seam: same boundary with an injectable HTTP layer. */
export function finalTransportFactoryWith(makeRequest: MakeRequest) {
  return (options: BaseTransportOptions): Transport =>
    buildFinalTransport(options, makeRequest);
}

function buildFinalTransport(options: BaseTransportOptions, makeRequest: MakeRequest): Transport {
  const base = createTransport(options, makeRequest);
  let inFlight = 0;
  let windowStart = Date.now();
  let sentInWindow = 0;
  return {
    async send(envelope: any): Promise<TransportMakeRequestResponse> {
      const rebuilt = rebuildEnvelope(envelope);
      if (!rebuilt) return { statusCode: 200 }; // nothing sendable
      const now = Date.now();
      if (now - windowStart >= RATE_WINDOW_MS) {
        windowStart = now;
        sentInWindow = 0;
      }
      if (sentInWindow + rebuilt.count > RATE_MAX) return { statusCode: 200 }; // dropped
      if (inFlight >= MAX_IN_FLIGHT) return { statusCode: 200 }; // dropped, no queue
      sentInWindow += rebuilt.count;
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
