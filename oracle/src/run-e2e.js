/**
 * Full E2E: register skill → request execution → oracle processes → verify settlement
 * Runs everything in one script.
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { MemData, Indexer } from '@0gfoundation/0g-ts-sdk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { hashInput, hashOutput, hashPrompt } from '../../shared/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = 'https://indexer-storage-testnet-turbo.0g.ai';
const REGISTRY_ADDR = '0xC4b41DA4FF0fcE60a6202864308983C23F3ea767';
const ESCROW_ADDR = '0xF725E9cf83d49c5789235A38734b863a8ACfFd07';

const REGISTRY_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillRegistry.json'), 'utf-8'));
const ESCROW_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillEscrow.json'), 'utf-8'));

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, wallet);
const indexer = new Indexer(INDEXER_URL);

async function main() {
  console.log('=== SkillMint Full E2E Pipeline ===\n');
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), '0G');

  // ─── Step 1: Register skill ──────────────────────────────────────────────
  console.log('\n[1/7] Registering skill...');
  const systemPrompt = 'You are a smart contract security auditor. Analyze the provided Solidity code and return JSON: { "vulnerabilities": [], "severity": "low|medium|high|critical", "recommendations": [] }';
  const promptHash = hashPrompt(systemPrompt);
  const computeProvider = '0xa48f01287233509FD694a22Bf840225062E67836';
  const model = 'qwen/qwen-2.5-7b-instruct';
  const price = ethers.parseEther('0.001');
  const metadata = JSON.stringify({
    name: 'Smart Contract Auditor',
    description: 'Audits Solidity code for vulnerabilities',
    systemPrompt,
  });

  const regTx = await registry.registerSkill(promptHash, computeProvider, model, price, metadata);
  await regTx.wait();
  const skillId = Number(await registry.skillCount());
  console.log(`  Skill #${skillId} registered. TX: ${regTx.hash}`);

  // ─── Step 2: Request execution (agent side) ──────────────────────────────
  console.log('\n[2/7] Requesting execution (agent pays escrow)...');
  const agentInput = 'pragma solidity ^0.8.0;\ncontract Vault {\n  mapping(address => uint) balances;\n  function withdraw() external {\n    uint bal = balances[msg.sender];\n    (bool ok,) = msg.sender.call{value: bal}("");\n    require(ok);\n    balances[msg.sender] = 0;\n  }\n}';
  const inputHash = hashInput(agentInput);

  const execTx = await escrow.requestExecution(skillId, inputHash, { value: price });
  const execReceipt = await execTx.wait();
  const parsed = execReceipt.logs.map(l => {
    try { return escrow.interface.parseLog(l); } catch { return null; }
  }).find(p => p?.name === 'ExecutionRequested');
  const executionId = parsed.args.executionId;
  console.log(`  ExecutionId: ${executionId}`);
  console.log(`  TX: ${execTx.hash}`);

  // ─── Step 3: Init broker + call TEE inference ────────────────────────────
  console.log('\n[3/7] Initializing broker + calling TEE inference...');
  const broker = await createZGComputeNetworkBroker(wallet);
  const headers = await broker.inference.getRequestHeaders(computeProvider);
  const { endpoint } = await broker.inference.getServiceMetadata(computeProvider);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: agentInput },
      ],
      model,
    }),
  });

  if (!res.ok) throw new Error(`Inference failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const output = data.choices[0].message.content;
  console.log(`  Output received (${output?.length || 0} chars)`);

  // ─── Step 4: Verify TEE ──────────────────────────────────────────────────
  console.log('\n[4/7] Verifying TEE attestation...');
  const chatID = res.headers.get('ZG-Res-Key') || data.id;
  const isValid = await broker.inference.processResponse(computeProvider, chatID);
  console.log(`  TEE verified: ${isValid}`);

  if (isValid === false) {
    console.error('  TAMPERED — aborting');
    process.exit(1);
  }

  // ─── Step 5: Upload receipt to 0G Storage ────────────────────────────────
  console.log('\n[5/7] Uploading receipt to 0G Storage...');
  const receipt = {
    executionId, skillId, inputHash,
    outputHash: hashOutput(output),
    chatID, teeVerified: isValid,
    providerAddress: computeProvider,
    timestamp: Date.now(),
    paidA0GI: ethers.formatEther(price),
    output,
  };

  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  const memData = new MemData(bytes);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`Merkle: ${treeErr}`);
  const receiptRootHash = tree.rootHash();
  console.log(`  receiptRootHash: ${receiptRootHash}`);

  const [uploadTx, uploadErr] = await indexer.upload(memData, RPC_URL, wallet);
  if (uploadErr) throw new Error(`Upload: ${uploadErr}`);
  console.log(`  Uploaded to 0G Storage.`);

  // ─── Step 6: Confirm execution on-chain ──────────────────────────────────
  console.log('\n[6/7] Confirming execution on-chain (90/10 split)...');
  // Contract expects the 0G Storage root hash directly (SkillEscrow.sol:133).
  const confirmTx = await escrow.confirmExecution(executionId, receiptRootHash);
  await confirmTx.wait();
  console.log(`  Confirmed. TX: ${confirmTx.hash}`);

  // ─── Step 7: Verify final state ──────────────────────────────────────────
  console.log('\n[7/7] Verifying final state...');
  const [total, successful, rate] = await registry.getReputationScore(skillId);
  console.log(`  Reputation: ${successful}/${total} (${rate}%)`);

  const devBalance = await escrow.developerBalances(wallet.address);
  console.log(`  Developer claimable: ${ethers.formatEther(devBalance)} 0G`);

  const exec = await escrow.getExecution(executionId);
  console.log(`  Settled: ${exec.settled}, Refunded: ${exec.refunded}`);

  console.log('\n=== FULL E2E PIPELINE COMPLETE ===');
  console.log(`SkillId:          ${skillId}`);
  console.log(`ExecutionId:      ${executionId}`);
  console.log(`ReceiptRootHash:  ${receiptRootHash}`);
  console.log(`TEE Verified:     ${isValid}`);
  console.log(`ChainScan:        https://chainscan-galileo.0g.ai/tx/${confirmTx.hash}`);
  console.log(`StorageScan:      https://storagescan-galileo.0g.ai/file/${receiptRootHash}`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
