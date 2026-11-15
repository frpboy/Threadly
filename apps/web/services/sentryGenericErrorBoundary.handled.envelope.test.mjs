import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/nextjs';
import { applyWebErrorBoundary, GENERIC_ERROR_MESSAGE } from './sentryGenericErrorBoundary';
import { captureHandledApiError } from './apiErrorCapture';

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

function captureTransport(sent) {
  // The SDK invokes options.transport as a factory.
  return function CaptureTransport() {
    return {
      send: async (envelope) => { sent.push(envelope); return { statusCode: 'success' }; },
      flush: async () => true,
    };
  };
}

async function freshClient(sent) {
  Sentry.init({
    dsn: 'http://public@127.0.0.1:1/1',
    transport: captureTransport(sent),
    autoSessionTracking: false,
    tracesSampleRate: 0,
    enableLogs: false,
    beforeSend(event, hint) {
      return applyWebErrorBoundary(event, hint);
    },
  });
  const scope = Sentry.getCurrentScope();
  // Adversarial scope: identity, secrets in extras/breadcrumbs, a settable
  // route tag, and an attachment - none of it may reach the wire.
  scope.setUser({ id: 'u1', email: 'resident@example.com', ip_address: '1.2.3.4' });
  scope.setExtra('sql', SECRET_SQL);
  scope.setTag('api_route', 'evil-' + SECRET_BEARER);
  scope.addBreadcrumb({ category: 'http', data: { url: 'https://threadly/api/x?code=' + SECRET_BEARER, headers: { authorization: SECRET_BEARER } } });
  if (typeof scope.addAttachment === 'function') {
    scope.addAttachment({ filename: 'debug.txt', data: SECRET_SQL, contentType: 'text/plain' });
  }
}

function assertNoLeak(sent) {
  const whole = sent.map((e) => JSON.stringify(decodeEnvelope(e))).join('\n');
  for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com', '1.2.3.4', 'duplicate key', 'evil-']) {
    assert.ok(!whole.includes(marker), 'leaked into envelope: ' + marker);
  }
  for (const [h] of sent.flatMap((e) => decodeEnvelope(e))) {
    assert.notEqual(h.type, 'attachment', 'attachment item survived');
  }
}

test('final wire: handled API error arrives constant plus trusted route tags only', async () => {
  const sent = [];
  await freshClient(sent);
  captureHandledApiError('guess', new Error(SECRET_SQL + ' ' + SECRET_BEARER));
  await Sentry.flush(4000);
  await Sentry.close(4000);

  assert.ok(sent.length >= 1, 'no envelope reached the transport');
  assertNoLeak(sent);
  const events = sent.flatMap((e) => decodeEnvelope(e)).filter(([h]) => h.type === 'event');
  assert.equal(events.length, 1, 'expected exactly one event envelope item');
  const event = JSON.parse(events[0][1]);
  for (const key of Object.keys(event)) {
    assert.ok(
      ['event_id', 'platform', 'level', 'timestamp', 'exception', 'fingerprint', 'tags', 'sdk'].includes(key),
      'unexpected key survived containment: ' + key
    );
  }
  assert.equal(event.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.deepEqual(event.tags, { handled_api_error: 'true', api_route: 'guess' });
  assert.deepEqual(event.fingerprint, ['handled-api-error', 'guess']);
});

