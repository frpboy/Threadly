import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/nextjs';
import { captureHandledApiError, GENERIC_HANDLED_API_ERROR_MESSAGE } from './apiErrorCapture';
import { scrubHandledApiEvent, stripHandledApiEventAttachments } from './apiErrorCapture';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';

// Decode an envelope array [headers, [[itemHeaders, payload], ...]] into plain text + parsed items.
function decodeEnvelope(envelope) {
  const [, items] = envelope;
  return items.map(([h, p]) => [
    h,
    typeof p === 'string' ? p : (p instanceof Uint8Array ? new TextDecoder().decode(p) : JSON.stringify(p)),
  ]);
}

test('real SDK envelope for a handled API error carries only the allowlisted shape', async () => {
  const sent = [];
  // The SDK invokes options.transport as a factory.
  function CaptureTransport() {
    return {
      send: async (envelope) => { sent.push(envelope); return { statusCode: 'success' }; },
      flush: async () => true,
    };
  }
  Sentry.init({
    dsn: 'http://public@127.0.0.1:1/1',
    transport: CaptureTransport,
    autoSessionTracking: false,
    tracesSampleRate: 0,
    enableLogs: false,
    beforeSend(event, hint) {
      stripHandledApiEventAttachments(event, hint);
      return scrubHandledApiEvent(event);
    },
  });
  const scope = Sentry.getCurrentScope();
  scope.setUser({ id: 'u1', email: 'resident@example.com', ip_address: '1.2.3.4' });
  scope.setExtra('sql', SECRET_SQL);
  scope.addBreadcrumb({ category: 'http', data: { url: SECRET_BEARER } });
  if (typeof scope.addAttachment === 'function') {
    scope.addAttachment({ filename: 'debug.txt', data: SECRET_SQL, contentType: 'text/plain' });
  }

  captureHandledApiError('guess', new Error(SECRET_SQL + ' ' + SECRET_BEARER));
  await Sentry.flush(4000);
  await Sentry.close(4000);

  assert.ok(sent.length >= 1, 'no envelope reached the transport');
  const whole = sent.map((e) => JSON.stringify(decodeEnvelope(e))).join('\n');
  for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com', '1.2.3.4', 'duplicate key']) {
    assert.ok(!whole.includes(marker), 'leaked into envelope: ' + marker);
  }
  const events = sent.flatMap((e) => decodeEnvelope(e)).filter(([h]) => h.type === 'event');
  assert.equal(events.length, 1, 'expected exactly one event envelope item');
  const event = JSON.parse(events[0][1]);
  for (const key of Object.keys(event)) {
    assert.ok(
      ['event_id', 'platform', 'level', 'timestamp', 'logger', 'message', 'tags', 'fingerprint', 'sdk'].includes(key),
      'unexpected key survived scrub: ' + key
    );
  }
  assert.equal(event.tags.handled_api_error, 'true');
  assert.equal(event.tags.api_route, 'guess');
  for (const [h] of sent.flatMap((e) => decodeEnvelope(e))) {
    assert.notEqual(h.type, 'attachment', 'attachment item survived');
  }
});
