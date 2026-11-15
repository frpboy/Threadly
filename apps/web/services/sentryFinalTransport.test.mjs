import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rebuildEnvelope,
  finalTransportFactoryWith,
  resetFinalTransportRateForTest,
} from './sentryFinalTransport';
import { GENERIC_ERROR_MESSAGE } from './sentryGenericErrorBoundary';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';

function hostileEventPayload(extra = {}) {
  return {
    event_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    platform: 'node',
    level: 'fatal',
    timestamp: 1,
    message: SECRET_SQL,
    exception: { values: [{ type: 'Error', value: SECRET_SQL, stacktrace: { frames: [{ vars: { pw: SECRET_BEARER } }] } }] },
    request: { url: 'https://threadly/api/auth/callback?code=' + SECRET_BEARER, headers: { cookie: 'session=1' } },
    user: { email: 'resident@example.com', ip_address: '1.2.3.4' },
    breadcrumbs: [{ data: { url: SECRET_BEARER } }],
    extra: { sql: SECRET_SQL },
    sdk: { name: 'sentry.javascript.nextjs', version: '10.78.0' },
    ...extra,
  };
}

function envelopeWith(eventPayload, extraItems = []) {
  return [
    { event_id: 'cccccccccccccccccccccccccccccccc', sent_at: '2026-01-01T00:00:00Z', trace: { user: 'resident@example.com', transaction: '/api/auth/callback?code=' + SECRET_BEARER } },
    [[{ type: 'event' }, eventPayload], ...extraItems],
  ];
}

test('rebuild: event reconstructed to constant shape, headers fresh, trace header dropped', () => {
  const out = rebuildEnvelope(envelopeWith(hostileEventPayload()));
  assert.ok(out);
  assert.equal(out.count, 1);
  const [headers, items] = out.envelope;
  assert.match(headers.event_id, /^[0-9a-f]{32}$/);
  assert.notEqual(headers.event_id, 'cccccccccccccccccccccccccccccccc');
  assert.ok(Math.abs(new Date(headers.sent_at).getTime() - Date.now()) < 5000);
  assert.ok(!('trace' in headers), 'SDK trace/sampling-context header forwarded');
  assert.equal(items.length, 1, 'rebuilt envelope must carry exactly one event item');
  const [itemHeaders, payload] = items[0];
  assert.equal(itemHeaders.type, 'event');
  assert.equal(headers.event_id, payload.event_id, 'header and payload event ids must match');
  assert.equal(payload.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.match(payload.event_id, /^[0-9a-f]{32}$/);
  assert.notEqual(payload.event_id, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.ok(Math.abs(payload.timestamp - Date.now() / 1000) < 5);
  assert.deepEqual(Object.keys(payload).sort(), ['event_id', 'exception', 'fingerprint', 'level', 'platform', 'timestamp'].sort());
  const json = JSON.stringify(out.envelope);
  for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com', '1.2.3.4', 'session=1', 'api/auth']) {
    assert.ok(!json.includes(marker), 'leaked: ' + marker);
  }
});

test('rebuild: multiple event items collapse to exactly one', () => {
  const two = rebuildEnvelope(envelopeWith(hostileEventPayload(), [
    [{ type: 'event' }, hostileEventPayload({ message: 'second ' + SECRET_SQL })],
  ]));
  assert.equal(two.count, 1);
  assert.equal(two.envelope[1].length, 1, 'second event item survived');
  assert.ok(!JSON.stringify(two.envelope).includes('second'), 'second event content leaked');
});

test('rebuild: non-event items dropped; envelope with no events becomes unsendable', () => {
  const withExtras = rebuildEnvelope(envelopeWith(hostileEventPayload(), [
    [{ type: 'attachment' }, SECRET_SQL],
    [{ type: 'session' }, { did: 'resident@example.com' }],
    [{ type: 'transaction' }, { transaction: '/api/auth/callback?code=' + SECRET_BEARER }],
    [{ type: 'client_report' }, { discarded_events: [] }],
  ]));
  assert.equal(withExtras.count, 1);
  const types = withExtras.envelope[1].map(([h]) => h.type);
  assert.deepEqual(types, ['event']);
  const none = rebuildEnvelope([{}, [[{ type: 'session' }, { did: 'x' }]]]);
  assert.equal(none, null, 'non-event-only envelope must not be sent');
});

test('rebuild: the optional route label is dropped at the final transport (structural forgery impossible)', () => {
  // Even a perfectly forged handled-event structure earns no label here:
  // the transport cannot verify beforeSend's identity provenance, so it
  // carries nothing structural over.
  const forged = rebuildEnvelope(envelopeWith(hostileEventPayload({
    tags: { handled_api_error: 'true', api_route: 'guess' },
    fingerprint: ['handled-api-error', 'guess'],
  })));
  const payload = forged.envelope[1][0][1];
  assert.ok(!payload.tags, 'tags survived reconstruction');
  assert.deepEqual(payload.fingerprint, ['web-generic-error']);
  assert.deepEqual(Object.keys(payload).sort(), ['event_id', 'exception', 'fingerprint', 'level', 'platform', 'timestamp'].sort());
});

test('rate: at most 30 events per process per minute reach the HTTP layer', async () => {
  resetFinalTransportRateForTest();
  const bodies = [];
  const factory = finalTransportFactoryWith(async (req) => { bodies.push(req.body); return { statusCode: 'success' }; });
  const transport = factory({ url: 'http://127.0.0.1/1', headers: {} });
  for (let i = 0; i < 35; i++) {
    await transport.send(envelopeWith(hostileEventPayload()));
  }
  assert.equal(bodies.length, 30, 'rate limit not enforced: ' + bodies.length);
});

test('drop busy: sends while one is in flight are dropped, never queued; flush settles', async () => {
  resetFinalTransportRateForTest();
  const bodies = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const factory = finalTransportFactoryWith(async (req) => {
    bodies.push(req.body);
    await gate; // every HTTP request hangs until released
    return { statusCode: 'success' };
  });
  const transport = factory({ url: 'http://127.0.0.1/1', headers: {} });
  const first = transport.send(envelopeWith(hostileEventPayload()));
  const second = transport.send(envelopeWith(hostileEventPayload()));
  const third = transport.send(envelopeWith(hostileEventPayload()));
  await new Promise((r) => setTimeout(r, 50)); // let all three settle their gate checks
  release();
  await Promise.all([first, second, third]);
  assert.equal(bodies.length, 1, 'busy sends were queued instead of dropped: ' + bodies.length);
  const settled = await transport.flush(2000);
  assert.equal(settled, true, 'flush did not settle after the in-flight send resolved');
});
