import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { hashInput } from './hash.js';

test('ASCII hello matches fixed expected value', () => {
  const expected = ethers.keccak256(ethers.toUtf8Bytes('hello'));
  assert.equal(hashInput('hello'), expected);
});

test('trailing LF changes hash (regression guard against trimming)', () => {
  assert.notEqual(hashInput('hello'), hashInput('hello\n'));
});

test('CRLF differs from LF (regression guard against line-ending normalization)', () => {
  assert.notEqual(hashInput('hello\n'), hashInput('hello\r\n'));
});

test('Unicode (CJK) hashes deterministically', () => {
  const a = hashInput('日本語テスト');
  const b = hashInput('日本語テスト');
  assert.equal(a, b);
  assert.notEqual(a, hashInput('日本語'));
});

test('ZWJ / emoji families hash deterministically', () => {
  const family = '👨‍👩‍👧';
  assert.equal(hashInput(family), hashInput(family));
  assert.notEqual(hashInput(family), hashInput('👨👩👧'));
});

test('leading and trailing spaces preserved (not trimmed)', () => {
  assert.notEqual(hashInput('hello'), hashInput(' hello'));
  assert.notEqual(hashInput('hello'), hashInput('hello '));
  assert.notEqual(hashInput(' hello '), hashInput('hello'));
});

test('large payload (10k chars) hashes without throwing', () => {
  const big = 'x'.repeat(10000);
  const h = hashInput(big);
  assert.match(h, /^0x[0-9a-f]{64}$/);
});

test('5000-char solidity-ish payload hashes deterministically', () => {
  const big = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n' + 'contract X { function f() public {} }\n'.repeat(200);
  assert.ok(big.length >= 5000);
  assert.equal(hashInput(big), hashInput(big));
});

test('non-string throws TypeError', () => {
  assert.throws(() => hashInput(123), TypeError);
  assert.throws(() => hashInput(null), TypeError);
  assert.throws(() => hashInput(undefined), TypeError);
  assert.throws(() => hashInput({ a: 1 }), TypeError);
});

test('empty string has a concrete hash (not an error)', () => {
  const h = hashInput('');
  assert.match(h, /^0x[0-9a-f]{64}$/);
});
