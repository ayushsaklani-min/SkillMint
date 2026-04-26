// Oracle x402 server — exposes skills as HTTP endpoints payable via x402.
//
// Flow:
//   GET  /skill/:id                 → metadata
//   POST /skill/:id/execute         → 402 Payment Required  (no X-PAYMENT)
//   POST /skill/:id/execute         → run + receipt + settle (with X-PAYMENT)
//
// The facilitator (running on :3099 in tests, :3002 in prod) handles
// EIP-3009 signature checks and on-chain settlement.
//
// Inference:
//   MOCK_INFERENCE=1   → returns a stub output (fast local testing)
//   otherwise          → initialises 0G Compute broker and runs real TEE
//                        inference (same path as the escrow-based oracle).

import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemData, Indexer } from '@0gfoundation/0g-ts-sdk';
import { hashInput, hashOutput } from '../../shared/hash.js';
import { serializeReceipt } from '../../shared/receipt.js';
import { decodePaymentHeader } from '../../facilitator/src/x402.js';
import { loadSystemPrompt } from './index-helpers.js';
import { decryptBuffer } from './crypto.js';
import { sha256Hex } from './agent-skill-bundle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────
// Accept shorthand (`testnet`/`mainnet`) and fully-qualified x402 names
// (`0g-testnet`/`0g-mainnet`) — the oracle service env uses the former,
// our x402 code elsewhere uses the latter.
const _NETWORK_RAW = process.env.NETWORK || '0g-testnet';
const IS_TESTNET = _NETWORK_RAW === '0g-testnet' || _NETWORK_RAW === 'testnet';
const NETWORK = IS_TESTNET ? '0g-testnet' : '0g-mainnet';
const RPC_URL = IS_TESTNET ? 'https://evmrpc-testnet.0g.ai' : 'https://evmrpc.0g.ai';
const INDEXER_URL = IS_TESTNET
  ? 'https://indexer-storage-testnet-turbo.0g.ai'
  : 'https://indexer-storage-turbo.0g.ai';
const REGISTRY_ADDR = IS_TESTNET
  ? '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4'
  : '';
const W0G_ADDR = process.env.W0G_ADDRESS || (IS_TESTNET
  ? '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D'
  : '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c');
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://127.0.0.1:3099';
const PORT = Number(process.env.X402_PORT || 3003);
const MOCK_INFERENCE = process.env.MOCK_INFERENCE === '1';
const BASE_URL = process.env.X402_BASE_URL || `http://localhost:${PORT}`;

const REGISTRY_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillRegistry.json'), 'utf8'));

// ─── Init ──────────────────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
const indexer = new Indexer(INDEXER_URL);

let broker = null;

async function initBroker() {
  if (MOCK_INFERENCE) { console.log('[x402] MOCK_INFERENCE=1 — skipping broker init'); return; }
  const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker');
  console.log('[x402] Initialising 0G Compute broker …');
  broker = await createZGComputeNetworkBroker(wallet);
  console.log('[x402] Broker ready.');
}

// ─── Inference ─────────────────────────────────────────────────────────────
async function runInference({ skill, input, skillId }) {
  if (MOCK_INFERENCE) {
    return {
      output: `[mock] skill=${skill.computeProvider} model=${skill.model} input_len=${input.length}`,
      chatID: 'mock-' + Date.now(),
      teeVerified: true,
      providerAddress: skill.computeProvider,
      model: skill.model,
    };
  }

  const systemPrompt = await loadSystemPrompt({
    skill, metadata: skill.metadata, skillId, indexer,
  });

  const headers = await broker.inference.getRequestHeaders(skill.computeProvider);
  const { endpoint } = await broker.inference.getServiceMetadata(skill.computeProvider);
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: input }],
      model: skill.model,
    }),
  });
  if (!res.ok) throw new Error(`inference HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const output = data.choices?.[0]?.message?.content;
  const chatID = res.headers.get('ZG-Res-Key') || data.id;
  const teeVerified = await broker.inference.processResponse(skill.computeProvider, chatID);
  return { output, chatID, teeVerified, providerAddress: skill.computeProvider, model: skill.model };
}

// ─── Skill lookup + pricing ────────────────────────────────────────────────
async function getSkillRequirements(skillId) {
  const skill = await registry.getSkill(skillId);
  if (!skill.active) throw new Error(`skill ${skillId} is not active`);
  const nftOwner = await registry.ownerOf(skillId);
  let metadata = {};
  try { metadata = JSON.parse(skill.metadata || '{}'); } catch { /* legacy */ }
  // Missing kind → "prompt" for back-compat with existing 8 prompt skills.
  const kind = metadata.kind === 'agent-skill' ? 'agent-skill' : 'prompt';
  // Price the skill in W0G at parity with its A0GI price
  return { skill, nftOwner, priceW0G: skill.priceA0GI, metadata, kind };
}

function buildPaymentRequirements({ skillId, priceW0G, nftOwner }) {
  return {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: priceW0G.toString(),
    resource: `${BASE_URL}/skill/${skillId}/execute`,
    description: `SkillMint skill #${skillId}`,
    mimeType: 'application/json',
    payTo: nftOwner,               // revenue goes directly to NFT owner
    maxTimeoutSeconds: 300,
    asset: W0G_ADDR,
    extra: { name: 'Wrapped 0G', version: '1' },
  };
}

// ─── HTTP ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    const [block, skillCount] = await Promise.all([
      provider.getBlockNumber(),
      registry.skillCount(),
    ]);
    res.json({
      ok: true,
      network: NETWORK,
      wallet: wallet.address,
      mockInference: MOCK_INFERENCE,
      block,
      skillCount: Number(skillCount),
      facilitatorUrl: FACILITATOR_URL,
    });
  } catch (e) {
    res.status(503).json({ ok: false, network: NETWORK, wallet: wallet.address, error: e.message });
  }
});

app.get('/skill/:id', async (req, res) => {
  try {
    const { skill, nftOwner, priceW0G } = await getSkillRequirements(req.params.id);
    res.json({
      skillId: Number(req.params.id),
      model: skill.model,
      priceW0G: priceW0G.toString(),
      priceW0GFormatted: ethers.formatEther(priceW0G),
      nftOwner,
      active: skill.active,
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ─── Shared facilitator + storage helpers ──────────────────────────────────

async function facilitatorVerify(paymentPayload, paymentRequirements) {
  return fetch(`${FACILITATOR_URL}/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  }).then(r => r.json());
}

async function facilitatorSettle(paymentPayload, paymentRequirements) {
  return fetch(`${FACILITATOR_URL}/settle`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paymentPayload, paymentRequirements }),
  }).then(r => r.json());
}

/** Upload arbitrary bytes to 0G Storage and return the merkle root hash. */
async function uploadToStorage(bytes) {
  const memData = new MemData(bytes);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`merkle: ${treeErr}`);
  const root = tree.rootHash();
  const [, uploadErr] = await indexer.upload(memData, RPC_URL, wallet);
  if (uploadErr) throw new Error(`upload: ${uploadErr}`);
  return root;
}

// ─── Prompt-skill handler (existing TEE-inference path) ────────────────────

async function handlePromptExecute({ skillId, skillInfo, paymentPayload, paymentRequirements, input, res }) {
  if (typeof input !== 'string' || input.length === 0) {
    return res.status(400).json({ error: 'body.input required (non-empty string)' });
  }

  const vr = await facilitatorVerify(paymentPayload, paymentRequirements);
  if (!vr.isValid) {
    return res.status(402).json({ x402Version: 1, accepts: [paymentRequirements], error: `verify: ${vr.invalidReason}` });
  }

  const inf = await runInference({ skill: skillInfo.skill, input, skillId });

  const receipt = {
    skillId: Number(skillId),
    kind: 'prompt',
    input,
    inputHash: hashInput(input),
    outputHash: hashOutput(inf.output),
    chatID: inf.chatID,
    teeVerified: inf.teeVerified,
    providerAddress: inf.providerAddress,
    model: inf.model,
    nftOwner: skillInfo.nftOwner,
    payer: vr.payer,
    paidW0G: ethers.formatEther(skillInfo.priceW0G),
    network: NETWORK,
    timestamp: Date.now(),
    output: inf.output,
  };
  const receiptRootHash = await uploadToStorage(new TextEncoder().encode(serializeReceipt(receipt)));

  const sr = await facilitatorSettle(paymentPayload, paymentRequirements);
  if (!sr.success) {
    return res.status(502).json({ error: `settle failed after inference: ${sr.error}`, receipt, receiptRootHash });
  }

  res.set('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(sr), 'utf8').toString('base64'));
  res.json({
    ok: true,
    skillId: Number(skillId),
    output: inf.output,
    receiptRootHash,
    settlement: sr,
  });
}

// ─── Agent-skill handler (new — pay → fetch → decrypt → verify → deliver) ──

async function handleAgentSkillDownload({ skillId, skillInfo, paymentPayload, paymentRequirements, res }) {
  const meta = skillInfo.metadata;
  if (!meta.bundleStorageRoot || !meta.bundleIv || !meta.bundleSha256) {
    return res.status(500).json({ error: 'agent-skill metadata missing bundle fields' });
  }

  // 1. Verify payment first — cheaper than fetching from storage on a bad payment.
  const vr = await facilitatorVerify(paymentPayload, paymentRequirements);
  if (!vr.isValid) {
    return res.status(402).json({ x402Version: 1, accepts: [paymentRequirements], error: `verify: ${vr.invalidReason}` });
  }

  // 2. Fetch encrypted bundle from 0G Storage.
  // The 0G TS SDK's Indexer.download takes (rootHash, outputPath, withProof?).
  // We need bytes in-memory, not on disk → write to a tmp file then read it back.
  const tmpPath = path.join(__dirname, `_tmp_bundle_${skillId}_${Date.now()}.bin`);
  let encryptedBytes;
  try {
    const dlErr = await indexer.download(meta.bundleStorageRoot, tmpPath, false);
    if (dlErr) throw new Error(`download: ${dlErr}`);
    encryptedBytes = fs.readFileSync(tmpPath);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  // 3. Decrypt + integrity check. If sha256 mismatches we DO NOT settle — that
  //    means storage is corrupted or the metadata was tampered, both of which
  //    are operator failures and the buyer should not pay.
  let decrypted;
  try {
    decrypted = decryptBuffer({
      ciphertext: encryptedBytes,
      iv: meta.bundleIv,
      algo: meta.bundleAlgo,
    });
  } catch (e) {
    return res.status(500).json({ error: `decrypt failed: ${e.message}` });
  }
  const observedSha = sha256Hex(decrypted);
  if (observedSha.toLowerCase() !== String(meta.bundleSha256).toLowerCase()) {
    return res.status(500).json({
      error: 'bundle integrity check failed (sha256 mismatch); not settling',
      expected: meta.bundleSha256,
      observed: observedSha,
    });
  }

  // 4. Build + upload receipt.
  const receipt = {
    skillId: Number(skillId),
    kind: 'agent-skill',
    payer: vr.payer,
    paidW0G: ethers.formatEther(skillInfo.priceW0G),
    network: NETWORK,
    bundleStorageRoot: meta.bundleStorageRoot,
    bundleSha256: meta.bundleSha256,
    manifest: meta.manifest || [],
    sizeBytes: meta.sizeBytes || decrypted.length,
    nftOwner: skillInfo.nftOwner,
    timestamp: Date.now(),
  };
  const receiptRootHash = await uploadToStorage(new TextEncoder().encode(serializeReceipt(receipt)));

  // 5. Settle. If settle fails, tell the buyer (no zip body) so they can retry.
  const sr = await facilitatorSettle(paymentPayload, paymentRequirements);
  if (!sr.success) {
    return res.status(502).json({ error: `settle failed: ${sr.error}`, receiptRootHash });
  }

  // 6. Deliver the bundle as application/zip. Headers carry the proofs the SDK
  //    needs to re-verify locally.
  const filename = (meta.name || `skill-${skillId}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}.skill"`,
    'Content-Length': String(decrypted.length),
    'X-Skill-Id': String(skillId),
    'X-Skill-Kind': 'agent-skill',
    'X-Receipt-Root': receiptRootHash,
    'X-Bundle-Sha256': meta.bundleSha256,
    'X-Manifest': Buffer.from(JSON.stringify(receipt.manifest), 'utf8').toString('base64'),
    'X-PAYMENT-RESPONSE': Buffer.from(JSON.stringify(sr), 'utf8').toString('base64'),
  });
  res.end(decrypted);
}

// ─── Route ──────────────────────────────────────────────────────────────────

app.post('/skill/:id/execute', async (req, res) => {
  const skillId = req.params.id;
  let skillInfo;
  try {
    skillInfo = await getSkillRequirements(skillId);
  } catch (e) {
    return res.status(404).json({ error: e.message });
  }
  const paymentRequirements = buildPaymentRequirements({ skillId, ...skillInfo });

  const paymentHeader = req.get('x-payment');
  if (!paymentHeader) {
    return res.status(402).json({
      x402Version: 1,
      accepts: [paymentRequirements],
      error: 'X-PAYMENT header required',
    });
  }

  let paymentPayload;
  try {
    paymentPayload = decodePaymentHeader(paymentHeader);
  } catch (e) {
    return res.status(402).json({ x402Version: 1, accepts: [paymentRequirements], error: `invalid X-PAYMENT: ${e.message}` });
  }

  try {
    if (skillInfo.kind === 'agent-skill') {
      return await handleAgentSkillDownload({ skillId, skillInfo, paymentPayload, paymentRequirements, res });
    }
    return await handlePromptExecute({
      skillId, skillInfo, paymentPayload, paymentRequirements,
      input: req.body?.input,
      res,
    });
  } catch (e) {
    console.error(`[x402] execute error (kind=${skillInfo.kind}):`, e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Boot ──────────────────────────────────────────────────────────────────
export async function startX402Server() {
  await initBroker();
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`[x402] oracle listening on :${PORT} network=${NETWORK} w0g=${W0G_ADDR} facilitator=${FACILITATOR_URL} mock=${MOCK_INFERENCE}`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('x402-server.js')) {
  startX402Server();
}
