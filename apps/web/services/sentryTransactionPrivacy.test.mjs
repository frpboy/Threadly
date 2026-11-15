import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  containTransactionEvent,
  containClientBreadcrumb,
} from './sentryTransactionPrivacy.ts';

const OAUTH_CODE = '4/0AfJohXn-secret-authorization-code-value';
const STATE = 'state-token-value-xyz';

test('auth callback transaction with OAuth code is dropped entirely', () => {
  const event = {
    transaction: '/api/auth/callback/google',
    request: {
      url: `https://threadly.frpboy.in/api/auth/callback/google?code=${OAUTH_CODE}&state=${STATE}`,
      query_string: `code=${OAUTH_CODE}&state=${STATE}`,
      method: 'GET',
    },
  };
  assert.equal(containTransactionEvent(event), null);
});

test('auth route variants are dropped by name or by URL path', () => {
  for (const event of [
    { transaction: '/api/auth/[...nextauth]', request: { url: `https://x/api/auth/session?code=${OAUTH_CODE}` } },
    { transaction: '/api/auth/signin', request: { url: '/api/auth/signin?callbackUrl=https%3A%2F%2Fx%2F' } },
    { transaction: 'GET', request: { url: `https://x/api/auth/csrf?state=${STATE}` } },
    { transaction: 'GET', request: { url: `/api/auth/error?error=OAuthCallback&code=${OAUTH_CODE}` } },
  ]) {
    assert.equal(containTransactionEvent(event), null, JSON.stringify(event));
  }
});

test('non-auth transaction keeps its path but loses query string and fragment', () => {
  const event = {
    transaction: '/api/archive/[id]',
    request: {
      url: 'https://threadly.frpboy.in/api/archive/abc123?ref=home#frag',
      query_string: 'ref=home',
      fragment: 'frag',
      method: 'GET',
    },
  };
  const out = containTransactionEvent(event);
  assert.ok(out);
  assert.equal(out.request.url, 'https://threadly.frpboy.in/api/archive/abc123');
  assert.ok(!('query_string' in out.request));
  assert.ok(!('fragment' in out.request));
  assert.equal(out.request.method, 'GET');
  assert.ok(!JSON.stringify(out).includes('ref=home'));
});

test('relative URLs are stripped the same way', () => {
  const out = containTransactionEvent({ transaction: '/api/guess', request: { url: '/api/guess?x=1' } });
  assert.equal(out.request.url, '/api/guess');
});

test('clean transaction passes through untouched', () => {
  const event = { transaction: '/api/leaderboard', request: { url: 'https://x/api/leaderboard', method: 'GET' } };
  const out = containTransactionEvent(event);
  assert.equal(out, event);
  assert.equal(out.request.url, 'https://x/api/leaderboard');
});

test('transaction without request is kept', () => {
  const event = { transaction: 'pageload /' };
  assert.equal(containTransactionEvent(event), event);
});

test('client breadcrumb containment drops console and ui.*, keeps navigation/fetch', () => {
  assert.equal(containClientBreadcrumb({ category: 'console', message: 'Error submitting guess' }), null);
  assert.equal(containClientBreadcrumb({ category: 'ui.click', message: 'button.submit' }), null);
  assert.equal(containClientBreadcrumb({ category: 'ui.input' }), null);
  const nav = { category: 'navigation', data: { to: '/archive' } };
  assert.equal(containClientBreadcrumb(nav), nav);
  const fetchCrumb = { category: 'fetch', data: { url: '/api/clue' } };
  assert.equal(containClientBreadcrumb(fetchCrumb), fetchCrumb);
});

test('all three Sentry configs wire the containment boundary and PII-off', () => {
  const dir = fileURLToPath(new URL('..', import.meta.url));
  const server = readFileSync(dir + '/sentry.server.config.ts', 'utf8');
  const edge = readFileSync(dir + '/sentry.edge.config.ts', 'utf8');
  const client = readFileSync(dir + '/instrumentation-client.ts', 'utf8');
  for (const [label, src] of [['server', server], ['edge', edge], ['client', client]]) {
    assert.ok(src.includes('sendDefaultPii: false'), label + ' sets sendDefaultPii: false');
    assert.ok(src.includes('tracesSampleRate: 0'), label + ' keeps tracesSampleRate at 0');
    assert.ok(src.includes('containTransactionEvent'), label + ' wires beforeSendTransaction');
  }
  assert.ok(client.includes('containClientBreadcrumb'), 'client wires beforeBreadcrumb');
  assert.ok(!client.includes('replaysSessionSampleRate'), 'client drops inert replay session rate');
  assert.ok(!client.includes('replaysOnErrorSampleRate'), 'client drops inert replay error rate');
  assert.ok(!client.includes('replayIntegration'), 'client never adds replayIntegration');
});
