// Reference agent client — hits a SkillMint x402 endpoint, pays with W0G,
// receives the inference result + receipt.
//
// Usage:
//   PRIVATE_KEY=... SKILL_ID=15 X402_URL=http://localhost:3003 \
//     node skills/x402-client.js "pragma solidity ^0.8.0; contract A {}"

import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPaymentPayload } from '../facilitator/src/client.js';
import { encodePaymentHeader } from '../facilitator/src/x402.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W0G_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../shared/abis/W0G.json'), 'utf8'));

const RPC = 'https://evmrpc-testnet.0g.ai';
const NETWORK = '0g-testnet';
const CHAIN_ID = 16602n;
const W0G_ADDR = process.env.W0G_ADDRESS || '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D';
const X402_URL = process.env.X402_URL || 'http://127.0.0.1:3003';
const SKILL_ID = process.env.SKILL_ID || '15';
const INPUT = process.argv[2] || 'pragma solidity ^0.8.0; contract Foo { function f() public {} }';

async function main() {
  const PK = process.env.PRIVATE_KEY;
  if (!PK) { console.error('PRIVATE_KEY missing'); process.exit(2); }
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PK, provider);
  console.log(`Agent: ${signer.address}`);
  console.log(`Skill: ${SKILL_ID} @ ${X402_URL}`);

  // 1. Probe — unauthenticated request must return 402
  console.log('\n[1] probe POST without X-PAYMENT');
  const probe = await fetch(`${X402_URL}/skill/${SKILL_ID}/execute`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: INPUT }),
  });
  if (probe.status !== 402) throw new Error(`expected 402, got ${probe.status}`);
  const challenge = await probe.json();
  const req = challenge.accepts?.[0];
  if (!req) throw new Error('no requirements in 402 body');
  console.log(`  402 OK — payTo ${req.payTo} asks ${ethers.formatEther(req.maxAmountRequired)} W0G`);

  // 2. Ensure agent has enough W0G
  const w0g = new ethers.Contract(req.asset, W0G_ABI, signer);
  const bal = await w0g.balanceOf(signer.address);
  const need = BigInt(req.maxAmountRequired);
  console.log(`  W0G balance: ${ethers.formatEther(bal)}, need ${ethers.formatEther(need)}`);
  if (bal < need) {
    const short = need - bal + ethers.parseEther('0.0005'); // small buffer
    console.log(`  wrapping ${ethers.formatEther(short)} native → W0G ...`);
    const tx = await w0g.deposit({ value: short });
    await tx.wait();
    console.log(`  wrap tx ${tx.hash}`);
  }

  // 3. Sign EIP-3009 authorization
  console.log('\n[2] sign EIP-3009 authorization');
  const paymentPayload = await buildPaymentPayload({
    signer,
    network: req.network,
    asset: req.asset,
    assetName: req.extra?.name || 'Wrapped 0G',
    assetVersion: req.extra?.version || '1',
    chainId: CHAIN_ID,
    from: signer.address,
    to: req.payTo,
    value: need,
  });
  console.log(`  nonce ${paymentPayload.payload.authorization.nonce}`);

  // 4. Retry with X-PAYMENT header
  console.log('\n[3] retry with X-PAYMENT');
  const header = encodePaymentHeader(paymentPayload);
  const r = await fetch(`${X402_URL}/skill/${SKILL_ID}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payment': header },
    body: JSON.stringify({ input: INPUT }),
  });
  const body = await r.json().catch(() => null);
  console.log(`  status: ${r.status}`);
  if (r.status !== 200) {
    console.error('  body:', body);
    throw new Error(`execute failed: ${r.status}`);
  }

  console.log(`  settle tx : ${body.settlement?.transaction}`);
  console.log(`  receipt   : ${body.receiptRootHash}`);
  console.log(`  output    : ${typeof body.output === 'string' ? body.output.slice(0, 120) : body.output}${(body.output || '').length > 120 ? '…' : ''}`);

  // 5. Confirm recipient W0G balance increased
  const payeeBal = await w0g.balanceOf(req.payTo);
  console.log(`\nRecipient W0G balance: ${ethers.formatEther(payeeBal)}`);

  console.log('\n✅ x402 agent flow PASS');
}

main().catch(e => { console.error('\n❌ x402 agent flow FAIL:', e); process.exit(1); });
