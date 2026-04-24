import 'dotenv/config';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { MemData, Indexer } from '@0gfoundation/0g-ts-sdk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { startApi } from './api.js';
import { decryptPrompt } from './crypto.js';
import { waitForInput } from './store.js';
import { hashInput, hashOutput } from '../../shared/hash.js';
import { serializeReceipt } from '../../shared/receipt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────────

const isTestnet = (process.env.NETWORK || 'testnet') === 'testnet';
const RPC_URL = isTestnet ? 'https://evmrpc-testnet.0g.ai' : 'https://evmrpc.0g.ai';
const INDEXER_URL = isTestnet
  ? 'https://indexer-storage-testnet-turbo.0g.ai'
  : 'https://indexer-storage-turbo.0g.ai';

// V2 contract addresses
const REGISTRY_ADDR = isTestnet
  ? '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4'
  : ''; // mainnet TBD
const ESCROW_ADDR = isTestnet
  ? '0xe2841b105B695610f2c1194f8865474A536184dB'
  : ''; // mainnet TBD

const REGISTRY_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillRegistry.json'), 'utf-8'));
const ESCROW_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillEscrow.json'), 'utf-8'));

// ─── Init ──────────────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, wallet);
const indexer = new Indexer(INDEXER_URL);

let broker;

async function initBroker() {
  console.log('[oracle] Initializing 0G Compute broker...');
  broker = await createZGComputeNetworkBroker(wallet);
  console.log('[oracle] Broker ready.');
}

// ─── Prompt loading ────────────────────────────────────────────────────────────

import { loadSystemPrompt as _loadSystemPrompt } from './index-helpers.js';
async function loadSystemPrompt(args) {
  return _loadSystemPrompt({ ...args, indexer });
}

// ─── Execute a Skill ───────────────────────────────────────────────────────────

async function executeSkill(executionId, skillId, agentAddr, inputHash, amount) {
  console.log(`\n[oracle] Processing execution ${executionId}`);
  console.log(`  skillId=${skillId} agent=${agentAddr} amount=${ethers.formatEther(amount)} 0G`);

  try {
    // 1. Fetch skill from V2 registry (returns struct, access by name)
    const skill = await registry.getSkill(skillId);
    const computeProvider = skill.computeProvider;
    const model = skill.model;
    const metadata = skill.metadata;
    console.log(`  model=${model} provider=${computeProvider}`);

    // Also show NFT owner (revenue recipient)
    const nftOwner = await registry.ownerOf(skillId);
    console.log(`  NFT owner (revenue recipient): ${nftOwner}`);

    // 2. Load system prompt — prefer encrypted storage payload, fall back to plaintext metadata
    const systemPrompt = await loadSystemPrompt({ skill, metadata, skillId });

    // 2b. Wait for the real user input posted to the oracle API
    const realInput = await waitForInput(executionId, 30000);
    if (!realInput) {
      throw new Error('Timed out waiting for input to be posted to oracle API');
    }
    const expectedHash = hashInput(realInput);
    if (expectedHash.toLowerCase() !== String(inputHash).toLowerCase()) {
      throw new Error(`Input hash mismatch: expected ${expectedHash} got ${inputHash}`);
    }
    console.log(`  Real input retrieved (${realInput.length} chars), hash matches`);

    // 3. Get request headers — v0.7.x: ONE param only
    const headers = await broker.inference.getRequestHeaders(computeProvider);

    // 4. Get endpoint
    const { endpoint } = await broker.inference.getServiceMetadata(computeProvider);

    // 5. Call TEE inference
    console.log(`  Calling inference at ${endpoint}...`);
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: realInput }
        ],
        model,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Inference HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const output = data.choices?.[0]?.message?.content;
    console.log(`  Output received (${output?.length || 0} chars)`);

    // 6. Extract chatID — ZG-Res-Key first, fallback to data.id
    const chatID = res.headers.get('ZG-Res-Key') || data.id;
    console.log(`  ChatID: ${chatID}`);

    // 7. Verify TEE attestation
    const isValid = await broker.inference.processResponse(computeProvider, chatID);
    console.log(`  TEE verified: ${isValid}`);

    if (isValid === false) {
      console.error('  TEE TAMPERED — triggering refund');
      const tx = await escrow.refund(executionId);
      await tx.wait();
      return;
    }

    // 8. Build receipt + upload to 0G Storage
    const receipt = {
      executionId,
      skillId: Number(skillId),
      input: realInput,
      inputHash,
      outputHash: hashOutput(output),
      chatID,
      teeVerified: isValid,
      providerAddress: computeProvider,
      nftOwner,
      timestamp: Date.now(),
      paidA0GI: ethers.formatEther(amount),
      output,
    };

    const bytes = new TextEncoder().encode(serializeReceipt(receipt));
    const memData = new MemData(bytes);
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr) throw new Error(`Merkle error: ${treeErr}`);
    const receiptRootHash = tree.rootHash();
    console.log(`  Receipt rootHash: ${receiptRootHash}`);

    const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, wallet);
    if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);
    console.log(`  Receipt uploaded to 0G Storage.`);

    // 9. Confirm execution on-chain — releases 90/10 split via PullPayment
    // Pass the storage root hash directly (already bytes32) so frontend can download the receipt
    const confirmTx = await escrow.confirmExecution(executionId, receiptRootHash);
    await confirmTx.wait();
    console.log(`  Execution confirmed on-chain. TX: ${confirmTx.hash}`);
    console.log(`[oracle] Done: ${executionId}`);

  } catch (err) {
    console.error(`[oracle] ERROR for ${executionId}:`, err.message);
    try {
      const exec = await escrow.getExecution(executionId);
      if (!exec.settled && !exec.refunded) {
        console.log('  Triggering refund...');
        const tx = await escrow.refund(executionId);
        await tx.wait();
        console.log('  Refunded.');
      }
    } catch (refundErr) {
      console.error('  Refund also failed:', refundErr.message);
    }
  }
}

// ─── Event Listener ────────────────────────────────────────────────────────────

async function processPastEvents() {
  console.log('[oracle] Scanning past ExecutionRequested events...');
  const filter = escrow.filters.ExecutionRequested();
  const events = await escrow.queryFilter(filter, -5000); // last 5000 blocks
  let pending = 0;
  for (const event of events) {
    const [executionId, skillId, agent, inputHash, amount] = event.args;
    const exec = await escrow.getExecution(executionId);
    if (!exec.settled && !exec.refunded) {
      pending++;
      console.log(`[oracle] Found pending: ${executionId}`);
      await executeSkill(executionId, skillId, agent, inputHash, amount);
    }
  }
  if (pending === 0) console.log('[oracle] No pending executions found.');
}

// Serialize execution handling — the oracle uses ONE wallet, and concurrent
// tx submission fights the nonce counter. Queue every ExecutionRequested so
// confirmExecution runs sequentially.
let executionQueue = Promise.resolve();

async function startListener() {
  console.log(`[oracle] Listening for ExecutionRequested on ${ESCROW_ADDR}...`);

  escrow.on('ExecutionRequested', (executionId, skillId, agent, inputHash, amount) => {
    console.log(`\n[oracle] Event: ExecutionRequested ${executionId}`);
    executionQueue = executionQueue
      .catch(() => {})
      .then(() => executeSkill(executionId, skillId, agent, inputHash, amount));
  });

  process.on('SIGINT', () => {
    console.log('\n[oracle] Shutting down...');
    process.exit(0);
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SkillMint Oracle Backend (V2) ===');
  console.log(`Network: ${isTestnet ? 'testnet' : 'mainnet'}`);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Registry: ${REGISTRY_ADDR}`);
  console.log(`Escrow: ${ESCROW_ADDR}`);

  await initBroker();
  startApi({ indexer, wallet, rpcUrl: RPC_URL });
  await processPastEvents();
  await startListener();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
