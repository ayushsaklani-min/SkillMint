import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { hashInput, hashPrompt } from '../../shared/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isTestnet = (process.env.NETWORK || 'testnet') === 'testnet';
const RPC_URL = isTestnet ? 'https://evmrpc-testnet.0g.ai' : 'https://evmrpc.0g.ai';
const REGISTRY_ADDR = '0xC4b41DA4FF0fcE60a6202864308983C23F3ea767';
const ESCROW_ADDR = '0xF725E9cf83d49c5789235A38734b863a8ACfFd07';

const REGISTRY_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillRegistry.json'), 'utf-8'));
const ESCROW_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/SkillEscrow.json'), 'utf-8'));

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, wallet);

async function main() {
  console.log('=== SkillMint E2E Test ===');
  console.log('Wallet:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), '0G\n');

  // 1. Register a test skill
  console.log('[1] Registering test skill...');
  const promptHash = hashPrompt('You are a smart contract auditor.');
  const computeProvider = '0xa48f01287233509FD694a22Bf840225062E67836'; // testnet qwen provider from Day 0
  const model = 'qwen/qwen-2.5-7b-instruct';
  const price = ethers.parseEther('0.001');
  const metadata = JSON.stringify({
    name: 'Smart Contract Auditor',
    description: 'Audits Solidity code for vulnerabilities',
    systemPrompt: 'You are a smart contract security auditor. Analyze the provided Solidity code and return a JSON object with: vulnerabilities (array), severity (string), recommendations (array).',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { vulnerabilities: { type: 'array' }, severity: { type: 'string' }, recommendations: { type: 'array' } } },
  });

  const regTx = await registry.registerSkill(promptHash, computeProvider, model, price, metadata);
  const regReceipt = await regTx.wait();
  const skillCount = await registry.skillCount();
  const skillId = Number(skillCount);
  console.log(`Skill registered: skillId=${skillId} tx=${regTx.hash}`);

  // 2. Request execution (agent pays escrow)
  console.log('\n[2] Requesting execution...');
  const inputHash = hashInput('pragma solidity ^0.8.0; contract Test {}');
  const execTx = await escrow.requestExecution(skillId, inputHash, { value: price });
  const execReceipt = await execTx.wait();

  const parsed = execReceipt.logs.map(l => {
    try { return escrow.interface.parseLog(l); } catch { return null; }
  }).find(p => p?.name === 'ExecutionRequested');

  const executionId = parsed.args.executionId;
  console.log(`Execution requested: id=${executionId} tx=${execTx.hash}`);

  console.log('\n[3] Execution registered on-chain.');
  console.log('The oracle backend (npm start) will pick up the ExecutionRequested event and:');
  console.log('  - Fetch prompt from storage');
  console.log('  - Call TEE inference');
  console.log('  - Verify via processResponse()');
  console.log('  - Upload receipt to 0G Storage');
  console.log('  - Call confirmExecution() on-chain');
  console.log('\nRun the oracle in a separate terminal: npm start');

  // Verify skill on-chain
  console.log('\n[4] Verifying skill on-chain...');
  const [id, dev, hash, cp, m, p, meta, active] = await registry.getSkill(skillId);
  console.log(`  ID: ${id}, Developer: ${dev}, Active: ${active}`);
  console.log(`  Model: ${m}, Price: ${ethers.formatEther(p)} 0G`);

  console.log('\n=== E2E Test Complete ===');
  console.log(`SkillId: ${skillId}`);
  console.log(`ExecutionId: ${executionId}`);
  console.log(`Registry TX: ${regTx.hash}`);
  console.log(`Escrow TX: ${execTx.hash}`);
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
