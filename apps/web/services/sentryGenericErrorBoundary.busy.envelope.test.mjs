import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sentry from '@sentry/nextjs';
import { applyWebErrorBoundary } from './sentryGenericErrorBoundary';
import { finalTransportFactoryWith } from './sentryFinalTransport';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";

test('final wire: busy HTTP layer drops within the flush deadline, then settles for real', async () => {
  let httpCalls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  Sentry.init({
    dsn: 'http://public@127.0.0.1:1/1',
    transport: finalTransportFactoryWith(async () => { httpCalls++; await gate; return { statusCode: 'success' }; }),
    autoSessionTracking: false,
    tracesSampleRate: 0,
    enableLogs: false,
    beforeSend(event, hint) { return applyWebErrorBoundary(event, hint); },
  });
  Sentry.captureException(new Error(SECRET_SQL));
  // Wait for the event to actually reach the hanging HTTP layer.
  const waitStart = Date.now();
  while (httpCalls === 0 && Date.now() - waitStart < 3000) {
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(httpCalls, 1, 'event never reached the HTTP layer');
  // A second event while busy must be dropped at the gate, never queued.
  Sentry.captureException(new Error(SECRET_SQL + ' again'));
  // The SDK's drain deadline uses an unref'd timer; keep the loop alive the
  // way a real server process would while we measure the deadline.
  const keepAlive = setInterval(() => {}, 100);
  const started = Date.now();
  const flushed = await Sentry.flush(1500);
  const elapsed = Date.now() - started;
  assert.equal(flushed, false, 'flush should report not-flushed while the HTTP layer hangs');
  assert.ok(elapsed < 5000, 'flush did not honor its deadline: ' + elapsed + 'ms');
  // Real settlement: once the HTTP layer responds, close completes cleanly.
  release();
  const closed = await Sentry.close(3000);
  clearInterval(keepAlive);
  assert.equal(closed, true, 'close did not settle after the HTTP layer released');
  assert.equal(httpCalls, 1, 'busy event was queued/retried instead of dropped: ' + httpCalls + ' HTTP calls');
});
