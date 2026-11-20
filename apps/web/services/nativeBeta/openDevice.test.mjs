import test from 'node:test';
import assert from 'node:assert/strict';
import { mintOpenCredential, digest, bearer } from './deviceAccess.mjs';

test('open credential: token shape, identity prefix, 90-day TTL', () => {
  const c = mintOpenCredential();
  assert.match(c.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(c.guestId, /^dev-[0-9a-f]{48}$/);
  assert.equal(c.expiresAt - Date.now() > 89 * 86400000, true);
  assert.equal(c.expiresAt - Date.now() <= 90 * 86400000, true);
});

test('open credential: two mints never share token or identity', () => {
  const a = mintOpenCredential(), b = mintOpenCredential();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.guestId, b.guestId);
});

test('bearer() accepts exactly the issued credential shape', () => {
  const c = mintOpenCredential();
  assert.equal(bearer('Bearer ' + c.token), c.token);
  assert.equal(bearer('bearer ' + c.token), null);
  assert.equal(bearer('Bearer short'), null);
  assert.equal(bearer(null), null);
});

test('digest is stable hex for token hashing at rest', () => {
  assert.match(digest('x'), /^[0-9a-f]{64}$/);
  assert.equal(digest('x'), digest('x'));
});
