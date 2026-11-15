import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  containGenericErrorEvent,
  applyWebErrorBoundary,
  GENERIC_ERROR_MESSAGE,
} from './sentryGenericErrorBoundary';
import { GENERIC_HANDLED_API_ERROR_MESSAGE } from './apiErrorCapture';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';
const SECRET_EMAIL = 'resident@example.com';
const MARKERS = [SECRET_SQL, SECRET_BEARER, SECRET_EMAIL, '1.2.3.4', 'duplicate key', 'api/auth', 'threadly@1.2.3'];

function hostileEvent() {
  return {
    event_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    platform: 'python',
    level: 'fatal',
    logger: 'secret-logger-' + SECRET_EMAIL,
    timestamp: Date.now() / 1000 - 7200,
    message: SECRET_SQL,
    exception: { values: [{ type: 'Error', value: SECRET_SQL, stacktrace: { frames: [{ filename: 'db.ts', vars: { pw: SECRET_BEARER } }] } }] },
    breadcrumbs: [{ category: 'http', data: { url: `https://x/?code=${SECRET_BEARER}` } }],
    request: { url: `https://threadly/api/auth/callback/google?code=${SECRET_BEARER}`, headers: { authorization: SECRET_BEARER, cookie: 'session=1' } },
    user: { id: 'u1', email: SECRET_EMAIL, ip_address: '1.2.3.4' },
    tags: { api_route: 'guess' },
    contexts: { device: { name: SECRET_EMAIL } },
    extra: { sql: SECRET_SQL },
    release: 'threadly@1.2.3',
    modules: { pg: '1.0.0' },
    environment: 'production',
    server_name: 'host-' + SECRET_EMAIL,
    fingerprint: ['attacker-chosen-' + SECRET_BEARER],
  };
}

test('final shape is constant-built: nothing copied from the incoming event', () => {
  const out = applyWebErrorBoundary(hostileEvent(), { originalException: new Error(SECRET_SQL) });
  const json = JSON.stringify(out);
  for (const marker of MARKERS) assert.ok(!json.includes(marker), 'leaked: ' + marker);
  assert.deepEqual(Object.keys(out).sort(), ['event_id', 'exception', 'fingerprint', 'level', 'platform', 'timestamp'].sort());
  assert.equal(out.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  assert.deepEqual(out.fingerprint, ['web-generic-error']);
  assert.equal(out.level, 'error');
});

test('event id and timestamp are always fresh, never carried over', () => {
  const a = applyWebErrorBoundary(hostileEvent(), {});
  assert.match(a.event_id, /^[0-9a-f]{32}$/);
  assert.notEqual(a.event_id, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.ok(Math.abs(a.timestamp - Date.now() / 1000) < 5, 'stale timestamp kept');
  const b = applyWebErrorBoundary({ ...hostileEvent(), timestamp: 'garbage', event_id: 12345 }, {});
  assert.match(b.event_id, /^[0-9a-f]{32}$/);
  assert.ok(Math.abs(b.timestamp - Date.now() / 1000) < 5);
  assert.notEqual(a.event_id, b.event_id);
});

test('platform comes from the calling config, never the event', () => {
  const serverOut = applyWebErrorBoundary(hostileEvent(), {});
  assert.equal(serverOut.platform, 'node');
  const clientOut = containGenericErrorEvent(hostileEvent(), {});
  assert.equal(clientOut.platform, 'javascript');
});

test('two different hostile errors produce the same constant shape (grouped, content-free)', () => {
  const a = applyWebErrorBoundary(hostileEvent(), {});
  const b = applyWebErrorBoundary({ ...hostileEvent(), message: 'different failure ' + SECRET_EMAIL }, {});
  delete a.event_id; delete b.event_id; delete a.timestamp; delete b.timestamp;
  assert.deepEqual(a, b);
});

test('user-settable handled tag alone is NOT trusted: no route label without our provenance', () => {
  const spoofed = {
    ...hostileEvent(),
    tags: { handled_api_error: 'true', api_route: 'guess' },
    message: GENERIC_HANDLED_API_ERROR_MESSAGE,
  };
  // originalException is an arbitrary (attacker-influenced) error, not our marker
  const out = applyWebErrorBoundary(spoofed, { originalException: new Error(SECRET_SQL) });
  assert.ok(!out.tags, 'route tags survived on spoofed provenance');
  assert.deepEqual(out.fingerprint, ['web-generic-error']);
  const json = JSON.stringify(out);
  for (const marker of MARKERS) assert.ok(!json.includes(marker), 'leaked: ' + marker);
});

test('route label only with our marker exception AND a finite trusted route code', () => {
  const hint = { originalException: new Error(GENERIC_HANDLED_API_ERROR_MESSAGE) };
  const good = applyWebErrorBoundary({ ...hostileEvent(), tags: { handled_api_error: 'true', api_route: 'guess' } }, hint);
  assert.deepEqual(good.tags, { handled_api_error: 'true', api_route: 'guess' });
  assert.deepEqual(good.fingerprint, ['handled-api-error', 'guess']);
  assert.equal(good.exception.values[0].value, GENERIC_ERROR_MESSAGE);
  const evil = applyWebErrorBoundary({ ...hostileEvent(), tags: { handled_api_error: 'true', api_route: 'evil-' + SECRET_BEARER } }, hint);
  assert.ok(!evil.tags, 'untrusted route code survived');
  assert.deepEqual(evil.fingerprint, ['web-generic-error']);
  const noTag = applyWebErrorBoundary({ ...hostileEvent(), tags: {} }, hint);
  assert.ok(!noTag.tags);
});

test('attachments are cleared through the hint for every event', () => {
  const hint = { attachments: [{ filename: 'debug.txt', data: SECRET_SQL }] };
  applyWebErrorBoundary(hostileEvent(), hint);
  assert.equal(hint.attachments.length, 0);
  const hint2 = { attachments: [{ filename: 'a', data: 'x' }] };
  containGenericErrorEvent(hostileEvent(), hint2);
  assert.equal(hint2.attachments.length, 0);
});

test('server, edge and client configs all wire the final boundary in beforeSend', () => {
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
