import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeReceipt } from './receipt.js';

test('same receipt → identical string across two runs', () => {
  const r = { a: 1, b: 2, c: 3 };
  assert.equal(serializeReceipt(r), serializeReceipt(r));
});

test('different insertion order → identical output (keys sorted)', () => {
  const a = { a: 1, b: 2, c: 3 };
  const b = { c: 3, a: 1, b: 2 };
  assert.equal(serializeReceipt(a), serializeReceipt(b));
});

test('keys appear alphabetically in output', () => {
  const r = { zebra: 1, apple: 2, mango: 3 };
  const out = serializeReceipt(r);
  assert.equal(out, '{"apple":2,"mango":3,"zebra":1}');
});

test('nested objects are also key-sorted recursively', () => {
  const r = { outer: { z: 1, a: 2, m: 3 }, top: 'x' };
  const out = serializeReceipt(r);
  assert.equal(out, '{"outer":{"a":2,"m":3,"z":1},"top":"x"}');
});

test('array order preserved (arrays are sequences, not maps)', () => {
  const r = { items: [3, 1, 2] };
  assert.equal(serializeReceipt(r), '{"items":[3,1,2]}');
});

test('array of objects: array order preserved, each object key-sorted', () => {
  const r = { items: [{ z: 1, a: 2 }, { b: 3, a: 4 }] };
  assert.equal(serializeReceipt(r), '{"items":[{"a":2,"z":1},{"a":4,"b":3}]}');
});

test('undefined values dropped (standard JSON behavior)', () => {
  const r = { a: 1, b: undefined, c: 3 };
  assert.equal(serializeReceipt(r), '{"a":1,"c":3}');
});

test('null preserved', () => {
  const r = { a: null, b: 2 };
  assert.equal(serializeReceipt(r), '{"a":null,"b":2}');
});

test('non-object throws', () => {
  assert.throws(() => serializeReceipt(null), TypeError);
  assert.throws(() => serializeReceipt(undefined), TypeError);
  assert.throws(() => serializeReceipt('string'), TypeError);
  assert.throws(() => serializeReceipt(42), TypeError);
  assert.throws(() => serializeReceipt([1, 2, 3]), TypeError);
});

test('realistic receipt shape produces stable bytes', () => {
  const r = {
    executionId: '0xabc',
    skillId: 1,
    input: 'hello',
    inputHash: '0x111',
    outputHash: '0x222',
    chatID: 'chat-x',
    teeVerified: true,
    providerAddress: '0xprov',
    nftOwner: '0xown',
    timestamp: 1234,
    paidA0GI: '0.001',
    output: 'world',
  };
  const a = serializeReceipt(r);
  const b = serializeReceipt({ ...r });
  assert.equal(a, b);
  // keys sorted
  const parsed = JSON.parse(a);
  assert.deepEqual(Object.keys(parsed), Object.keys(parsed).slice().sort());
});
