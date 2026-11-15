import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  captureHandledApiError,
  scrubHandledApiEvent,
  stripHandledApiEventAttachments,
  HANDLED_API_ERROR_TAG,
  GENERIC_HANDLED_API_ERROR_MESSAGE,
} from './apiErrorCapture';

const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';
const SECRET_EMAIL = 'resident@example.com';
const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";

test('capture emits only the generic grouped event, never raw error content', () => {
  const calls = [];
  const raw = new Error(`${SECRET_SQL}; ${SECRET_BEARER}`);
  const id = captureHandledApiError('guess', raw, (exc, ctx) => { calls.push([exc, ctx]); return 'evt-1'; });
  assert.equal(id, 'evt-1');
  assert.equal(calls.length, 1);
  const [exc, ctx] = calls[0];
  assert.equal(exc.message, GENERIC_HANDLED_API_ERROR_MESSAGE);
  const serialized = JSON.stringify([exc.message, exc.stack, ctx]);
  for (const marker of [SECRET_SQL, SECRET_BEARER, SECRET_EMAIL, 'duplicate key']) {
    assert.ok(!serialized.includes(marker), 'leaked: ' + marker);
  }
  assert.equal(ctx.tags[HANDLED_API_ERROR_TAG], 'true');
  assert.equal(ctx.tags.api_route, 'guess');
  assert.deepEqual(ctx.fingerprint, ['handled-api-error', 'guess']);
});

test('scrub reduces tagged events to the allowlist and strips SDK/scope enrichment', () => {
  const tagged = {
    event_id: 'e1', platform: 'node', level: 'error', timestamp: 1,
    message: GENERIC_HANDLED_API_ERROR_MESSAGE,
    tags: { [HANDLED_API_ERROR_TAG]: 'true', api_route: 'daily', other: 'drop' },
    fingerprint: ['handled-api-error', 'daily'],
    exception: { values: [{ type: 'Error', value: SECRET_SQL }] },
    request: { url: 'https://x/api/daily', headers: { Authorization: SECRET_BEARER, Cookie: 'session=1' } },
    user: { id: 'u1', email: SECRET_EMAIL, ip_address: '1.2.3.4' },
    breadcrumbs: { values: [{ category: 'http', data: { url: SECRET_BEARER } }] },
    contexts: { device: { model: 'x' }, trace: { trace_id: 't' } },
    extra: { sql: SECRET_SQL },
    modules: { pg: '1' }, release: 'rel', environment: 'production', server_name: 'host',
  };
  const out = scrubHandledApiEvent(tagged);
  assert.deepEqual(Object.keys(out).sort(), ['event_id', 'fingerprint', 'level', 'message', 'platform', 'tags', 'timestamp'].sort());
  assert.deepEqual(out.tags, { [HANDLED_API_ERROR_TAG]: 'true', api_route: 'daily' });
  const serialized = JSON.stringify(out);
  for (const marker of [SECRET_SQL, SECRET_BEARER, SECRET_EMAIL, 'session=1', '1.2.3.4', 'trace_id']) {
    assert.ok(!serialized.includes(marker), 'leaked: ' + marker);
  }
});

test('scrub leaves untagged events untouched', () => {
  const normal = { event_id: 'e2', tags: {}, request: { url: 'https://x' }, user: { ip_address: '9.9.9.9' } };
  assert.equal(scrubHandledApiEvent(normal), normal);
});

test('attachment stripping applies only to tagged events', () => {
  const hint = { attachments: [{ filename: 'dump.txt', data: SECRET_SQL }] };
  stripHandledApiEventAttachments({ tags: { [HANDLED_API_ERROR_TAG]: 'true' } }, hint);
  assert.equal(hint.attachments.length, 0);
  const keep = { attachments: [{ filename: 'ok.txt', data: 'x' }] };
  stripHandledApiEventAttachments({ tags: {} }, keep);
  assert.equal(keep.attachments.length, 1);
  stripHandledApiEventAttachments({ tags: { [HANDLED_API_ERROR_TAG]: 'true' } }, undefined);
});

test('server and edge Sentry configs wire the handled-error boundary (via the generic boundary wrapper)', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['sentry.server.config.ts', 'sentry.edge.config.ts']) {
    const src = readFileSync(root + name, 'utf8');
    // The configs wire applyWebErrorBoundary, which applies
    // stripHandledApiEventAttachments + scrubHandledApiEvent internally.
    assert.ok(src.includes('applyWebErrorBoundary'), name + ' missing error-boundary wiring');
    assert.ok(/beforeSend\s*\(/.test(src), name + ' missing beforeSend');
  }
});
