import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/ratelimit.js';

function fakeClock() {
  let t = 1_000_000;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('10 allowed, 11th blocked within window', () => {
  const clock = fakeClock();
  const rl = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });
  for (let i = 0; i < 10; i++) {
    assert.equal(rl.check('1.1.1.1').allowed, true, `req ${i + 1}`);
  }
  const res = rl.check('1.1.1.1');
  assert.equal(res.allowed, false);
  assert.ok(res.retryAfter > 0 && res.retryAfter <= 60);
});

test('counter resets after window elapses', () => {
  const clock = fakeClock();
  const rl = createRateLimiter({ limit: 10, windowMs: 60_000, now: clock.now });
  for (let i = 0; i < 10; i++) rl.check('1.1.1.1');
  assert.equal(rl.check('1.1.1.1').allowed, false);
  clock.advance(61_000);
  assert.equal(rl.check('1.1.1.1').allowed, true);
});

test('different IPs have independent buckets', () => {
  const clock = fakeClock();
  const rl = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });
  assert.equal(rl.check('1.1.1.1').allowed, true);
  assert.equal(rl.check('1.1.1.1').allowed, true);
  assert.equal(rl.check('1.1.1.1').allowed, false);
  assert.equal(rl.check('2.2.2.2').allowed, true);
  assert.equal(rl.check('2.2.2.2').allowed, true);
  assert.equal(rl.check('2.2.2.2').allowed, false);
});

test('retryAfter shrinks as the window progresses', () => {
  const clock = fakeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
  rl.check('9.9.9.9');
  const a = rl.check('9.9.9.9').retryAfter;
  clock.advance(30_000);
  const b = rl.check('9.9.9.9').retryAfter;
  assert.ok(b < a, `expected ${b} < ${a}`);
});

test('cleanup prunes expired buckets when size exceeds maxBuckets', () => {
  const clock = fakeClock();
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxBuckets: 3, now: clock.now });
  rl.check('1.1.1.1');
  rl.check('2.2.2.2');
  rl.check('3.3.3.3');
  clock.advance(2000);
  // 4th IP triggers cleanup of the three expired buckets
  rl.check('4.4.4.4');
  assert.equal(rl._buckets.size, 1);
  assert.ok(rl._buckets.has('4.4.4.4'));
});
