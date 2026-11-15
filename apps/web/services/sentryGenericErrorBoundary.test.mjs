import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  containGenericErrorEvent,
  applyWebErrorBoundary,
  GENERIC_ERROR_MESSAGE,
} from './sentryGenericErrorBoundary';
import { captureHandledApiError } from './apiErrorCapture';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';
const SECRET_EMAIL = 'resident@example.com';

function hostileEvent() {
  return {
    event_id: '0123456789abcdef0123456789abcdef',
    platform: 'node',
    level: 'error',
    timestamp: Date.now() / 1000,
    message: SECRET_SQL,
    exception: { values: [{ type: 'Error', value: SECRET_SQL, stacktrace: { frames: [{ filename: 'db.ts', vars: { pw: SECRET_BEARER } }] } }] },
    breadcrumbs: [{ category: 'http', data: { url: `https://x/?code=${SECRET_BEARER}` } }],
    request: { url: `https://threadly/api/auth/callback/google?code=${SECRET_BEARER}`, headers: { authorization: SECRET_BEARER } },
    user: { id: 'u1', email: SECRET_EMAIL, ip_address: '1.2.3.4' },
    tags: { api_route: 'guess' },
    contexts: { device: { name: SECRET_EMAIL } },
    extra: { sql: SECRET_SQL },
    release: 'threadly@1.2.3',
    modules: { pg: '1.0.0' },
  };
}

test('generic boundary reduces a hostile uncaught-error event to the fixed shape', () => {
  const out = containGenericErrorEvent(hostileEvent(), {});
  const json = JSON.stringify(out);
  for (const marker of [SECRET_SQL, SECRET_BEARER, SECRET_EMAIL, '1.2.3.4', 'duplicate key', 'api/auth', 'threadly@1.2.3']) {
    assert.ok(!json.includes(marker), 'leaked into contained event: ' + marker);
  }
  assert.deepEqual(Object.keys(out).sort(), ['event_id', 'exception', 'fingerprint', 'level', 'platform', 'timestamp'].sort());
  assert.equal(out.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.deepEqual(out.fingerprint, ['web-generic-error']);
  assert.equal(out.level, 'error');
  assert.equal(out.platform, 'node');
});

test('two different hostile errors produce the same fixed shape (grouped, content-free)', () => {
  const a = containGenericErrorEvent(hostileEvent(), {});
  const b = containGenericErrorEvent({ ...hostileEvent(), message: 'totally different failure ' + SECRET_EMAIL }, {});
  delete a.event_id; delete b.event_id; delete a.timestamp; delete b.timestamp;
  assert.deepEqual(a, b);
});

test('event id kept only when 32-hex; timestamp kept only when fresh', () => {
  const good = containGenericErrorEvent(hostileEvent(), {});
  assert.equal(good.event_id, '0123456789abcdef0123456789abcdef');
  const badId = containGenericErrorEvent({ ...hostileEvent(), event_id: 'not-an-id-' + SECRET_BEARER }, {});
  assert.ok(!('event_id' in badId), 'invalid event id survived');
  const stale = Date.now() / 1000 - 3600;
  const oldTs = containGenericErrorEvent({ ...hostileEvent(), timestamp: stale }, {});
  assert.ok(Math.abs(oldTs.timestamp - Date.now() / 1000) < 5, 'stale timestamp kept');
  const garbageTs = containGenericErrorEvent({ ...hostileEvent(), timestamp: 'garbage' }, {});
  assert.ok(typeof garbageTs.timestamp === 'number' && Number.isFinite(garbageTs.timestamp));
});

test('attachments are cleared through the hint for every event', () => {
  const hint = { attachments: [{ filename: 'debug.txt', data: SECRET_SQL }] };
  containGenericErrorEvent(hostileEvent(), hint);
  assert.equal(hint.attachments.length, 0);
});

test('applyWebErrorBoundary: handled API events keep their route-tagged generic shape', () => {
  let captured;
  captureHandledApiError('guess', new Error(SECRET_SQL), (exc, ctx) => {
    captured = { tags: ctx.tags, message: exc.message, fingerprint: ctx.fingerprint };
    return 'evt-1';
  });
  const event = {
    event_id: '0123456789abcdef0123456789abcdef',
    platform: 'node',
    timestamp: Date.now() / 1000,
    tags: captured.tags,
    message: captured.message,
    exception: { values: [{ type: 'Error', value: captured.message }] },
    extra: { sql: SECRET_SQL },
    user: { email: SECRET_EMAIL },
  };
  const out = applyWebErrorBoundary(event, {});
  assert.equal(out.tags.handled_api_error, 'true');
  assert.equal(out.tags.api_route, 'guess', 'handled route tag must survive the boundary');
  assert.ok(!JSON.stringify(out).includes(SECRET_SQL));
  assert.ok(!JSON.stringify(out).includes(SECRET_EMAIL));
});

test('applyWebErrorBoundary: untagged events get the full generic shape', () => {
  const out = applyWebErrorBoundary(hostileEvent(), {});
  assert.equal(out.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.ok(!JSON.stringify(out).includes(SECRET_SQL));
  assert.ok(!out.tags, 'tags survived');
});

test('server, edge and client configs all wire the generic boundary in beforeSend', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const server = readFileSync(here + '../sentry.server.config.ts', 'utf8');
  const edge = readFileSync(here + '../sentry.edge.config.ts', 'utf8');
  const client = readFileSync(here + '../instrumentation-client.ts', 'utf8');
  for (const [name, src] of [['server', server], ['edge', edge]]) {
    assert.ok(src.includes('applyWebErrorBoundary'), name + ' config does not wire applyWebErrorBoundary');
    assert.ok(src.includes('beforeSend'), name + ' config lost beforeSend');
  }
  assert.ok(client.includes('containGenericErrorEvent'), 'client config does not wire containGenericErrorEvent');
  assert.ok(client.includes('beforeSend'), 'client config lost beforeSend');
});
