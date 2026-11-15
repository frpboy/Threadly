import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import * as Sentry from '@sentry/nextjs';
import { applyWebErrorBoundary, GENERIC_ERROR_MESSAGE } from './sentryGenericErrorBoundary';
import { finalTransportFactoryRealHttpForTest } from './sentryFinalTransport';

const SECRET_SQL = "duplicate key value violates unique constraint users_pkey DETAIL: Key (email)=(resident@example.com)";
const SECRET_BEARER = 'Bearer abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ1234567890_-';
const DEADLINE_MS = 800;

test('real HTTP path: deadline aborts a hung connection, busy event dropped, settlement for real', async () => {
  const received = [];
  let hang = true;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push(body);
      // Never respond while `hang` is set: a stuck server/connection.
      const iv = setInterval(() => {
        if (!hang) { clearInterval(iv); res.writeHead(200).end('ok'); }
      }, 50);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const keepAlive = setInterval(() => {}, 100); // SDK drain deadline uses unref'd timers
  try {
    Sentry.init({
      dsn: `http://public@127.0.0.1:${port}/1`,
      transport: finalTransportFactoryRealHttpForTest(DEADLINE_MS),
      autoSessionTracking: false,
      tracesSampleRate: 0,
      enableLogs: false,
      beforeSend(event, hint) { return applyWebErrorBoundary(event, hint); },
    });
    const scope = Sentry.getCurrentScope();
    scope.setUser({ id: 'u1', email: 'resident@example.com' });
    scope.setExtra('sql', SECRET_SQL);

    const started = Date.now();
    Sentry.captureException(new Error(SECRET_SQL + ' ' + SECRET_BEARER));
    const waitStart = Date.now();
    while (received.length === 0 && Date.now() - waitStart < 4000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(received.length, 1, 'event never reached the real HTTP server');

    // What actually arrived over real HTTP: one constant event, ids matching.
    const lines = received[0].split('\n').filter((l) => l.length > 0);
    const headers = JSON.parse(lines[0]);
    const itemHeaders = JSON.parse(lines[1]);
    const event = JSON.parse(lines[2]);
    assert.equal(lines.length, 3, 'more than one envelope item on the wire');
    assert.equal(itemHeaders.type, 'event');
    assert.equal(headers.event_id, event.event_id, 'header/payload id mismatch on the wire');
    assert.equal(event.exception.values[0].value, GENERIC_ERROR_MESSAGE);
    for (const marker of [SECRET_SQL, SECRET_BEARER, 'resident@example.com']) {
      assert.ok(!received[0].includes(marker), 'leaked over real HTTP: ' + marker);
    }

    // A second event while the connection is hung must be dropped, not queued.
    Sentry.captureException(new Error(SECRET_SQL + ' again'));

    // The deadline must abort the hung connection and settle close for real.
    const closed = await Sentry.close(5000);
    const elapsed = Date.now() - started;
    assert.equal(closed, true, 'close did not settle after the deadline abort');
    assert.ok(elapsed >= DEADLINE_MS - 200, 'settled before the deadline could engage: ' + elapsed + 'ms');
    assert.ok(elapsed < 6000, 'no cooperative deadline: ' + elapsed + 'ms');
    assert.equal(received.length, 1, 'busy event was queued instead of dropped');
  } finally {
    hang = false;
    clearInterval(keepAlive);
    await new Promise((r) => server.close(r));
  }
});
