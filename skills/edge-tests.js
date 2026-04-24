/**
 * Days 6-7 edge-case tests (live testnet, against the running oracle).
 *
 * Covers:
 *  (a) input-hash mismatch → oracle refunds
 *  (b) receipt-tamper detection → output hash recomputation fails
 *  (c) 3 concurrent executions → distinct executionIds, all settle, all verify
 *  (d) large input (>5000 chars) → full pipeline still produces a green receipt
 *
 * Not covered here (already in contracts/test/SkillMintV2.test.js):
 *  - NFT transfer mid-execution → payee snapshot (line 334)
 *  - Refund after 5-minute timeout (line 355)
 *
 * Usage:  ORACLE_URL=http://<oracle>:3001 node edge-tests.js
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { Indexer } from '@0gfoundation/0g-ts-sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashInput } from '../shared/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC = 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = 'https://indexer-storage-testnet-turbo.0g.ai';
const ESCROW = '0xe2841b105B695610f2c1194f8865474A536184dB';
const ORACLE_URL = (process.env.ORACLE_URL || 'http://3.110.116.169:3001').replace(/\/$/, '');

const ESCROW_ABI = [
  'function requestExecution(uint256 skillId, bytes32 inputHash) payable returns (bytes32)',
  'function getExecution(bytes32 executionId) view returns (tuple(bytes32 executionId, uint256 skillId, address agent, bytes32 inputHash, uint256 amount, address payeeAtFunding, uint256 createdAt, bool settled, bool refunded))',
  'event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount)',
  'event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, address payee, uint256 payeeAmount, uint256 treasuryAmount)',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function postInput(executionId, input) {
  const res = await fetch(`${ORACLE_URL}/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ executionId, input }),
  });
  if (!res.ok) throw new Error(`POST /input ${res.status}: ${await res.text()}`);
}

async function waitFor(escrow, executionId, { maxMs = 300_000, pollMs = 5000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const e = await escrow.getExecution(executionId);
    if (e.settled) return { settled: true };
    if (e.refunded) return { refunded: true };
    await sleep(pollMs);
  }
  return { timedOut: true };
}

async function downloadReceipt(indexer, root) {
  const tmp = path.join(os.tmpdir(), `edge-${root.slice(0, 16)}.json`);
  const err = await indexer.download(root, tmp, true);
  if (err) throw new Error(`download: ${err}`);
  const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
  try { fs.unlinkSync(tmp); } catch {}
  return data;
}

async function requestExec(escrow, skillId, input, price) {
  const tx = await escrow.requestExecution(skillId, hashInput(input), { value: price });
  const rcpt = await tx.wait();
  const ev = rcpt.logs
    .map(l => { try { return escrow.interface.parseLog(l); } catch { return null; } })
    .find(p => p && p.name === 'ExecutionRequested');
  return { executionId: ev.args.executionId, txHash: tx.hash };
}

// ─── (a) input-hash mismatch ─────────────────────────────────────────────────
async function testInputHashMismatch(escrow, price) {
  console.log('\n(a) input-hash mismatch — agent posts wrong input to oracle');
  const declared = 'pragma solidity ^0.8.0; contract GoodActor {}';
  const posted   = 'pragma solidity ^0.8.0; contract EvilActor {}';
  const { executionId } = await requestExec(escrow, 15, declared, price);
  await postInput(executionId, posted); // different from what was hashed
  const state = await waitFor(escrow, executionId, { maxMs: 90_000 });
  record(
    '(a) mismatched input is refunded (not settled)',
    state.refunded === true,
    state.settled ? 'BUG: settled with mismatched input' : state.timedOut ? 'timed out' : 'refunded'
  );
}

// ─── (b) receipt tamper detection ───────────────────────────────────────────
async function testReceiptTamperDetection(indexer) {
  console.log('\n(b) receipt tamper — flip a byte in the output, recomputation fails');
  const logPath = path.join(__dirname, 'execution-log.json');
  if (!fs.existsSync(logPath)) {
    record('(b) receipt tamper detection', false, 'execution-log.json missing — run execute-all first');
    return;
  }
  const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  const entry = log.find(r => r.pass && r.storageRoot);
  if (!entry) { record('(b) receipt tamper detection', false, 'no passing entry in log'); return; }
  const receipt = await downloadReceipt(indexer, entry.storageRoot);
  const cleanMatch = hashInput(receipt.output).toLowerCase() === String(receipt.outputHash).toLowerCase();
  const tampered = { ...receipt, output: receipt.output.replace(/.$/, c => c === 'x' ? 'y' : 'x') };
  const tamperMatch = hashInput(tampered.output).toLowerCase() === String(receipt.outputHash).toLowerCase();
  record(
    '(b) untampered receipt hashes match',
    cleanMatch,
    cleanMatch ? '' : 'BASELINE FAILED — existing receipt is broken'
  );
  record(
    '(b) tampered receipt recomputation fails',
    cleanMatch && !tamperMatch,
    tamperMatch ? 'BUG: tamper went undetected' : `caught flip in output[${receipt.output.length - 1}]`
  );
}

// ─── (c) 3 concurrent executions ────────────────────────────────────────────
async function testConcurrentThree(escrow, indexer, price) {
  console.log('\n(c) 3 concurrent executions — distinct ids, all settle, all verify');
  const inputs = [
    'pragma solidity ^0.8.0; contract A { function f() public {} }',
    'pragma solidity ^0.8.0; contract B { function g() public {} }',
    'pragma solidity ^0.8.0; contract C { function h() public {} }',
  ];

  // Fire 3 requests back-to-back (same nonce sequence but different inputs → different ids)
  const funded = [];
  for (let i = 0; i < inputs.length; i++) {
    const r = await requestExec(escrow, 15, inputs[i], price);
    funded.push({ input: inputs[i], ...r });
  }

  const ids = funded.map(f => f.executionId);
  const distinct = new Set(ids).size === ids.length;
  record('(c) executionIds are distinct', distinct, ids.join(', '));

  // Post inputs
  await Promise.all(funded.map(f => postInput(f.executionId, f.input)));

  // Wait for all to settle in parallel (max 3 min)
  const outcomes = await Promise.all(funded.map(f => waitFor(escrow, f.executionId)));
  const allSettled = outcomes.every(o => o.settled);
  record(
    '(c) all 3 settle without refund',
    allSettled,
    outcomes.map((o, i) => o.settled ? 'settled' : o.refunded ? 'refunded' : 'timeout').join(', ')
  );

  // Verify each receipt end-to-end
  if (allSettled) {
    let verified = 0;
    for (const f of funded) {
      const head = await escrow.runner.provider.getBlockNumber();
      const events = await escrow.queryFilter(escrow.filters.ExecutionConfirmed(f.executionId), Math.max(0, head - 500), head);
      if (events.length === 0) continue;
      const root = String(events[events.length - 1].args.receiptHash);
      const receipt = await downloadReceipt(indexer, root);
      const outputOk = hashInput(receipt.output).toLowerCase() === String(receipt.outputHash).toLowerCase();
      const inputOk = hashInput(f.input).toLowerCase() === String(receipt.inputHash).toLowerCase();
      if (outputOk && inputOk) verified++;
    }
    record('(c) all 3 receipts verify (input + output hashes)', verified === 3, `${verified}/3 verified`);
  }
}

// ─── (d) large input (>5000 chars) ──────────────────────────────────────────
async function testLargeInput(escrow, indexer, price) {
  console.log('\n(d) large input — 5000+ chars through full pipeline');
  const header = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n';
  const bulk = 'contract Scaled { function f() public pure returns (uint) { return 1; } }\n'.repeat(70);
  const input = header + bulk;
  if (input.length < 5000) throw new Error(`test bug: input is ${input.length} chars, need ≥5000`);

  const { executionId } = await requestExec(escrow, 15, input, price);
  await postInput(executionId, input);
  const state = await waitFor(escrow, executionId);
  if (!state.settled) {
    record('(d) large input settles', false, state.refunded ? 'refunded' : 'timed out');
    return;
  }

  const head = await escrow.runner.provider.getBlockNumber();
  const events = await escrow.queryFilter(escrow.filters.ExecutionConfirmed(executionId), Math.max(0, head - 500), head);
  if (events.length === 0) {
    record('(d) large input settles', false, 'no ExecutionConfirmed event');
    return;
  }
  const root = String(events[events.length - 1].args.receiptHash);
  const receipt = await downloadReceipt(indexer, root);
  const inputOk = hashInput(input).toLowerCase() === String(receipt.inputHash).toLowerCase();
  const outputOk = hashInput(receipt.output).toLowerCase() === String(receipt.outputHash).toLowerCase();
  record('(d) large-input receipt verifies', inputOk && outputOk, `input=${input.length}ch, output=${receipt.output?.length || 0}ch`);
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Oracle: ${ORACLE_URL}\nEscrow: ${ESCROW}\n`);
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
  const indexer = new Indexer(INDEXER_URL);
  const price = ethers.parseEther('0.001');

  await testInputHashMismatch(escrow, price);
  await testReceiptTamperDetection(indexer);
  await testConcurrentThree(escrow, indexer, price);
  await testLargeInput(escrow, indexer, price);

  console.log(`\n=== Summary ===`);
  const passed = results.filter(r => r.pass).length;
  for (const r of results) console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
  console.log(`${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(err => { console.error('FATAL:', err); process.exit(2); });
