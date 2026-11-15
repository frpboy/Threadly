import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/nextjs';
import { applyWebErrorBoundary, GENERIC_ERROR_MESSAGE } from './sentryGenericErrorBoundary';
import { finalTransportFactoryWith } from './sentryFinalTransport';
import { captureHandledApiError } from './apiErrorCapture';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';

function parseWire(body) {
  const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
  const lines = text.split('\n').filter((l) => l.length > 0);
  const headers = JSON.parse(lines[0]);
  const items = [];
  for (let i = 1; i < lines.length; i += 2) {
    let payload = lines[i + 1];
    try { payload = JSON.parse(lines[i + 1]); } catch { /* keep raw */ }
    items.push([JSON.parse(lines[i]), payload]);
  }
  return { headers, items, text };
}

test('final wire: handled API error leaves as the same constant shape (route label dropped at final transport)', async () => {
  const bodies = [];
  Sentry.init({
    dsn: 'http://public@127.0.0.1:1/1',
    transport: finalTransportFactoryWith(async (req) => { bodies.push(req.body); return { statusCode: 'success' }; }),
    autoSessionTracking: false,
    tracesSampleRate: 0,
    enableLogs: false,
    beforeSend(event, hint) { return applyWebErrorBoundary(event, hint); },
  });
  const scope = Sentry.getCurrentScope();
  scope.setUser({ id: 'u1', email: 'resident@example.com', ip_address: '1.2.3.4' });
  scope.setExtra('sql', SECRET_SQL);
  scope.addBreadcrumb({ category: 'http', data: { url: 'https://threadly/api/x?code=' + SECRET_BEARER } });
  if (typeof scope.addAttachment === 'function') {
    scope.addAttachment({ filename: 'debug.txt', data: SECRET_SQL, contentType: 'text/plain' });
  }

  captureHandledApiError('guess', new Error(SECRET_SQL + ' ' + SECRET_BEARER));
  await Sentry.flush(4000);
  await Sentry.close(4000);

  assert.equal(bodies.length, 1, 'expected exactly one HTTP request body');
  const { headers, items, text } = parseWire(bodies[0]);
  for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com', '1.2.3.4', 'duplicate key']) {
    assert.ok(!text.includes(marker), 'leaked on the wire: ' + marker);
  }
  assert.ok(!('trace' in headers), 'trace header forwarded');
  assert.equal(items.length, 1);
  const [itemHeaders, event] = items[0];
  assert.equal(itemHeaders.type, 'event');
  for (const key of Object.keys(event)) {
    assert.ok(
      ['event_id', 'platform', 'level', 'timestamp', 'exception', 'fingerprint'].includes(key),
      'unexpected key on the wire: ' + key
    );
  }
  assert.equal(event.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.ok(!event.tags, 'tags reached the wire (final transport must drop them)');
  assert.deepEqual(event.fingerprint, ['web-generic-error']);
});
