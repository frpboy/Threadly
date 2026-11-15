import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  captureHandledApiError,
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

test('server and edge Sentry configs wire the handled-error boundary (via the generic boundary wrapper)', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['sentry.server.config.ts', 'sentry.edge.config.ts']) {
    const src = readFileSync(root + name, 'utf8');
    // The configs wire applyWebErrorBoundary (sentryGenericErrorBoundary),
    // the single constant final shape for handled and untagged events alike.
    assert.ok(src.includes('applyWebErrorBoundary'), name + ' missing error-boundary wiring');
    assert.ok(/beforeSend\s*\(/.test(src), name + ' missing beforeSend');
  }
});
