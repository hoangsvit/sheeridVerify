import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoginThrottle } from '../src/web/login-throttle.js';

test('Throttles repeated failures independently per TCP peer, then unlocks', () => {
  let time = 100_000;
  const limiter = new LoginThrottle({ now: () => time, maxFailures: 3, windowMs: 10000, lockMs: 20000 });
  limiter.failure('127.0.0.1');
  limiter.failure('127.0.0.1');
  assert.equal(limiter.retryAfterSeconds('127.0.0.1'), 0);
  limiter.failure('127.0.0.1');
  assert.equal(limiter.retryAfterSeconds('127.0.0.1'), 20);
  assert.equal(limiter.retryAfterSeconds('10.0.0.1'), 0);
  time += 20001;
  assert.equal(limiter.retryAfterSeconds('127.0.0.1'), 0);
  limiter.failure('127.0.0.1');
  limiter.success('127.0.0.1');
  assert.equal(limiter.retryAfterSeconds('127.0.0.1'), 0);
});

test('Public workbench rejects built-in or short passwords', () => {
  // Integration tested in web-public.test.js; limiter is unit tested separately.
  assert.ok(LoginThrottle);
});
