import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/nextjs';
import { applyWebErrorBoundary, GENERIC_ERROR_MESSAGE } from './sentryGenericErrorBoundary';
import { finalTransportFactoryWith } from './sentryFinalTransport';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';

// Parse a serialized envelope body: first line headers, then per item a
// header line and a payload line.
function parseWire(body) {
  const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
  const lines = text.split('\n').filter((l) => l.length > 0);
  const headers = JSON.parse(lines[0]);
  const items = [];
  for (let i = 1; i + 1 < lines.length + 1; i += 2) {
    if (i >= lines.length) break;
    const itemHeaders = JSON.parse(lines[i]);
    const rawPayload = lines[i + 1];
    let payload = rawPayload;
    try { payload = JSON.parse(rawPayload); } catch { /* binary/string item */ }
    items.push([itemHeaders, payload]);
    if (itemHeaders.length !== undefined) break; // length-delimited items: not expected in these tests
  }
  return { headers, items, text };
}

test('final wire: uncaught-style error leaves as constant shape over serialized bytes only', async () => {
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
  scope.setTag('api_route', 'evil-' + SECRET_BEARER);
  scope.addBreadcrumb({ category: 'http', data: { url: 'https://threadly/api/x?code=' + SECRET_BEARER, headers: { authorization: SECRET_BEARER } } });
  if (typeof scope.addAttachment === 'function') {
    scope.addAttachment({ filename: 'debug.txt', data: SECRET_SQL, contentType: 'text/plain' });
  }

  Sentry.captureException(new Error(SECRET_SQL + ' ' + SECRET_BEARER));
  await Sentry.flush(4000);
  await Sentry.close(4000);

  assert.equal(bodies.length, 1, 'expected exactly one HTTP request body');
  const { headers, items, text } = parseWire(bodies[0]);
  for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com', '1.2.3.4', 'duplicate key', 'evil-']) {
    assert.ok(!text.includes(marker), 'leaked on the wire: ' + marker);
  }
  assert.ok(!('trace' in headers), 'trace/sampling-context header forwarded');
  assert.match(headers.event_id, /^[0-9a-f]{32}$/);
  assert.equal(items.length, 1, 'expected exactly one envelope item');
  const [itemHeaders, event] = items[0];
  assert.equal(itemHeaders.type, 'event');
  for (const key of Object.keys(event)) {
    assert.ok(
      ['event_id', 'platform', 'level', 'timestamp', 'exception', 'fingerprint'].includes(key),
      'unexpected key on the wire (SDK post-metadata must be gone): ' + key
    );
  }
  assert.equal(event.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.deepEqual(event.fingerprint, ['web-generic-error']);
});
