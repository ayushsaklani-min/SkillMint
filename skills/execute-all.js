/**
 * Run the full input corpus through every published skill.
 *
 * For each input:
 *   fund → post to oracle → wait for settlement → download receipt → verify 4 checks
 *
 * Writes skills/execution-log.json. Exits 0 only if all executions pass all checks.
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { Indexer } from '@0gfoundation/0g-ts-sdk';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashInput } from '../shared/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = 'https://indexer-storage-testnet-turbo.0g.ai';
const REGISTRY_ADDR = '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4';
const ESCROW_ADDR = '0xe2841b105B695610f2c1194f8865474A536184dB';
const ORACLE_URL = (process.env.ORACLE_URL || 'http://localhost:3001').replace(/\/$/, '');

const SETTLE_POLL_MS = 5_000;
const SETTLE_MAX_WAIT_MS = 180_000;
const THROTTLE_MS = 3_000;
const EVENT_LOOKBACK_BLOCKS = 500;
const EVENT_RETRIES = 5;

const REGISTRY_ABI = [
  'function getSkill(uint256 skillId) view returns (tuple(address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata, uint256 executionCount, uint256 successfulExecutions, uint256 totalRevenueEarned, uint64 createdAt, bool active, bool exists))',
];
const ESCROW_ABI = [
  'function requestExecution(uint256 skillId, bytes32 inputHash) payable returns (bytes32)',
  'function getExecution(bytes32 executionId) view returns (tuple(bytes32 executionId, uint256 skillId, address agent, bytes32 inputHash, uint256 amount, address payeeAtFunding, uint256 createdAt, bool settled, bool refunded))',
  'event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount)',
  'event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, address payee, uint256 payeeAmount, uint256 treasuryAmount)',
];

const SLUG_MAP = {
  'Smart Contract Auditor': 'auditor',
  'Token Sentiment Scorer': 'sentiment',
  'Transaction Intent Classifier': 'tx-classifier',
  'Document Summarizer': 'summarizer',
  'Wallet Risk Profiler': 'wallet-risk',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function inputToString(raw) {
  if (typeof raw === 'string') return raw;
  return JSON.stringify(raw);
}

async function postInput(executionId, input) {
  const res = await fetch(`${ORACLE_URL}/input`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ executionId, input }),
  });
  if (!res.ok) throw new Error(`POST /input: HTTP ${res.status}`);
}

async function waitForSettlement(escrow, executionId) {
  const start = Date.now();
  while (Date.now() - start < SETTLE_MAX_WAIT_MS) {
    const exec = await escrow.getExecution(executionId);
    if (exec.settled) return { settled: true, refunded: false };
    if (exec.refunded) return { settled: false, refunded: true };
    await sleep(SETTLE_POLL_MS);
  }
  return { settled: false, refunded: false, timedOut: true };
}

async function downloadReceipt(indexer, rootHash) {
  const tmp = path.join(os.tmpdir(), `receipt-${rootHash.slice(0, 16)}.json`);
  const err = await indexer.download(rootHash, tmp, true);
  if (err) throw new Error(`Storage download: ${err}`);
  const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
  try { fs.unlinkSync(tmp); } catch {}
  return data;
}

async function verifyOne({ receipt, storageRoot, execOnChain, confirmedEvent }) {
  const rootMatch = confirmedEvent
    ? String(confirmedEvent.args.receiptHash).toLowerCase() === storageRoot.toLowerCase()
    : false;

  const inputHashOnChain =
    String(receipt.inputHash).toLowerCase() === String(execOnChain.inputHash).toLowerCase();

  const inputRecompute =
    receipt.input != null
      ? hashInput(receipt.input).toLowerCase() === String(receipt.inputHash).toLowerCase()
      : null;

  const outputRecompute =
    hashInput(receipt.output).toLowerCase() === String(receipt.outputHash).toLowerCase();

  return { rootMatch, inputHashOnChain, inputRecompute, outputRecompute };
}

async function main() {
  const published = JSON.parse(fs.readFileSync(path.join(__dirname, 'published.json'), 'utf-8'));
  if (!Array.isArray(published) || published.length === 0) {
    throw new Error('skills/published.json is empty — run register-all.js first');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
  const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, wallet);
  const indexer = new Indexer(INDEXER_URL);

  console.log(`Executing ${published.length} skills × 6 inputs = ${published.length * 6} executions`);
  console.log('Agent wallet:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'A0GI\n');

  const outPath = path.join(__dirname, 'execution-log.json');
  const log = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : [];
  const donePass = new Set(log.filter(r => r.pass).map(r => `${r.skillId}:${r.inputIndex}`));
  let failures = log.filter(r => !r.pass).length;
  // drop prior failures — we're retrying them
  for (let i = log.length - 1; i >= 0; i--) if (!log[i].pass) log.splice(i, 1);
  console.log(`Resume: ${donePass.size} already passed, will skip those.\n`);

  for (const pub of published) {
    const slug = SLUG_MAP[pub.name];
    if (!slug) { console.warn(`[warn] no input file slug for "${pub.name}" — skipping`); continue; }
    const inputsPath = path.join(__dirname, 'inputs', `${slug}.json`);
    if (!fs.existsSync(inputsPath)) { console.warn(`[warn] missing ${inputsPath} — skipping`); continue; }

    const rawInputs = JSON.parse(fs.readFileSync(inputsPath, 'utf-8'));
    const skillOnChain = await registry.getSkill(pub.skillId);
    const priceWei = skillOnChain.priceA0GI;

    for (let i = 0; i < rawInputs.length; i++) {
      if (donePass.has(`${pub.skillId}:${i}`)) continue;
      const input = inputToString(rawInputs[i]);
      const label = `skill #${pub.skillId} (${slug}) input ${i + 1}/${rawInputs.length}`;
      const started = Date.now();
      console.log(`\n▶ ${label}`);

      try {
        const inputHash = hashInput(input);
        const tx = await escrow.requestExecution(pub.skillId, inputHash, { value: priceWei });
        const rcpt = await tx.wait();
        const reqEvent = rcpt.logs
          .map(l => { try { return escrow.interface.parseLog(l); } catch { return null; } })
          .find(p => p && p.name === 'ExecutionRequested');
        if (!reqEvent) throw new Error('ExecutionRequested event not found in receipt');
        const executionId = reqEvent.args.executionId;
        console.log(`  executionId: ${executionId}`);

        await postInput(executionId, input);

        const state = await waitForSettlement(escrow, executionId);
        if (state.timedOut) throw new Error('settlement timed out');
        if (state.refunded) throw new Error('execution was refunded');

        const confirmedFilter = escrow.filters.ExecutionConfirmed(executionId);
        let confirmed = null;
        for (let attempt = 0; attempt < EVENT_RETRIES; attempt++) {
          const head = await provider.getBlockNumber();
          const from = Math.max(0, head - EVENT_LOOKBACK_BLOCKS);
          const events = await escrow.queryFilter(confirmedFilter, from, head);
          if (events.length > 0) { confirmed = events[events.length - 1]; break; }
          await sleep(2000);
        }
        if (!confirmed) throw new Error('no ExecutionConfirmed event found after retries');
        const storageRoot = String(confirmed.args.receiptHash);

        const receipt = await downloadReceipt(indexer, storageRoot);
        const execOnChain = await escrow.getExecution(executionId);
        const checks = await verifyOne({ receipt, storageRoot, execOnChain, confirmedEvent: confirmed });

        const allCriticalPass =
          checks.rootMatch && checks.inputHashOnChain && checks.outputRecompute &&
          (checks.inputRecompute === true || checks.inputRecompute === null);

        log.push({
          skillId: pub.skillId,
          slug,
          inputIndex: i,
          executionId,
          txHash: tx.hash,
          storageRoot,
          verificationChecks: checks,
          settled: true,
          durationMs: Date.now() - started,
          pass: !!allCriticalPass,
        });
        if (allCriticalPass) console.log(`  ✅ pass (${Date.now() - started}ms)`);
        else { console.log(`  ❌ fail — checks: ${JSON.stringify(checks)}`); failures++; }
      } catch (err) {
        console.error(`  ❌ ${err.message}`);
        log.push({ skillId: pub.skillId, slug, inputIndex: i, error: err.message, pass: false });
        failures++;
      }

      fs.writeFileSync(outPath, JSON.stringify(log, null, 2));
      await sleep(THROTTLE_MS);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(log, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`${log.length - failures}/${log.length} passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
