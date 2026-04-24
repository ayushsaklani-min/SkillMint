// Live Galileo e2e test for the facilitator.
// Boots the facilitator in-process against W0G on testnet, then:
//   1. Ensures the signer has ≥ 0.002 W0G (wraps if not)
//   2. Signs an EIP-3009 authorization paying 0.001 W0G to a throwaway recipient
//   3. Hits POST /verify → expect isValid:true
//   4. Hits POST /settle → expect tx hash, recipient balance increases
//
// Usage (from facilitator/):  PRIVATE_KEY=... FACILITATOR_KEY=... node test/e2e-testnet.js
import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPaymentPayload } from '../src/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W0G_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/W0G.json'), 'utf8'));

const RPC = 'https://evmrpc-testnet.0g.ai';
const NETWORK = '0g-testnet';
const CHAIN_ID = 16602n;
const W0G_ADDR = process.env.W0G_ADDRESS || '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D';
const RECIPIENT = '0x000000000000000000000000000000000000dEaD';
const AMOUNT = ethers.parseEther('0.001');

const PK = process.env.PRIVATE_KEY;
if (!PK) { console.error('PRIVATE_KEY missing'); process.exit(2); }
// Default facilitator key to same signer (single-wallet testnet demo)
process.env.FACILITATOR_KEY = process.env.FACILITATOR_KEY || PK;
process.env.NETWORK = NETWORK;
process.env.W0G_ADDRESS = W0G_ADDR;
process.env.FACILITATOR_PORT = '3099';

const FAC = `http://127.0.0.1:${process.env.FACILITATOR_PORT}`;

function log(msg) { console.log(msg); }

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

async function main() {
  log(`\n=== Facilitator e2e — Galileo ===`);
  log(`W0G: ${W0G_ADDR}`);
  const provider = new ethers.JsonRpcProvider(RPC);
  const signer = new ethers.Wallet(PK, provider);
  log(`Signer: ${signer.address}`);
  const w0g = new ethers.Contract(W0G_ADDR, W0G_ABI, signer);

  // 1. Ensure signer has >= 0.002 W0G
  let bal = await w0g.balanceOf(signer.address);
  log(`W0G balance: ${ethers.formatEther(bal)}`);
  const need = AMOUNT * 2n;
  if (bal < need) {
    const short = need - bal;
    log(`Wrapping ${ethers.formatEther(short)} native → W0G ...`);
    const tx = await w0g.deposit({ value: short });
    await tx.wait();
    bal = await w0g.balanceOf(signer.address);
    log(`  new balance: ${ethers.formatEther(bal)}`);
  }

  const recipientBefore = await w0g.balanceOf(RECIPIENT);
  log(`Recipient W0G before: ${ethers.formatEther(recipientBefore)}`);

  // 2. Start facilitator (dynamic import so env vars take effect)
  const { startFacilitator } = await import('../src/index.js');
  const server = startFacilitator();
  await new Promise(r => setTimeout(r, 400));

  try {
    // 3. Build payload + requirements
    const paymentPayload = await buildPaymentPayload({
      signer,
      network: NETWORK,
      asset: W0G_ADDR,
      assetName: 'Wrapped 0G',
      assetVersion: '1',
      chainId: CHAIN_ID,
      from: signer.address,
      to: RECIPIENT,
      value: AMOUNT,
    });
    const paymentRequirements = {
      scheme: 'exact',
      network: NETWORK,
      maxAmountRequired: AMOUNT.toString(),
      resource: 'https://oracle.example/skill/15/execute',
      description: 'e2e test',
      mimeType: 'application/json',
      payTo: RECIPIENT,
      maxTimeoutSeconds: 300,
      asset: W0G_ADDR,
      extra: { name: 'Wrapped 0G', version: '1' },
    };

    // 4. /verify
    log('\nPOST /verify ...');
    const v = await post(`${FAC}/verify`, { paymentPayload, paymentRequirements });
    log(`  ${v.status} ${JSON.stringify(v.json)}`);
    if (v.json.isValid !== true) throw new Error(`verify failed: ${v.json.invalidReason}`);

    // 5. /supported sanity
    const sup = await fetch(`${FAC}/supported`).then(r => r.json());
    log(`/supported: ${JSON.stringify(sup)}`);
    if (!sup.kinds?.[0]?.asset) throw new Error('/supported missing asset');

    // 6. /settle
    log('\nPOST /settle ...');
    const s = await post(`${FAC}/settle`, { paymentPayload, paymentRequirements });
    log(`  ${s.status} ${JSON.stringify(s.json)}`);
    if (s.json.success !== true) throw new Error(`settle failed: ${s.json.error}`);
    const txHash = s.json.transaction;

    // 7. Confirm recipient balance increased by AMOUNT
    await provider.waitForTransaction(txHash, 1, 60_000);
    const recipientAfter = await w0g.balanceOf(RECIPIENT);
    const delta = recipientAfter - recipientBefore;
    log(`\nRecipient W0G after : ${ethers.formatEther(recipientAfter)}`);
    log(`Delta: ${ethers.formatEther(delta)}`);
    if (delta !== AMOUNT) throw new Error(`recipient delta ${delta} != expected ${AMOUNT}`);

    // 8. Replay /settle — must now fail because nonce is used
    log('\nPOST /settle (replay) — should fail ...');
    const replay = await post(`${FAC}/settle`, { paymentPayload, paymentRequirements });
    log(`  ${replay.status} ${JSON.stringify(replay.json)}`);
    if (replay.json.success === true) throw new Error('replay unexpectedly succeeded');

    log('\n✅ e2e PASS');
    log(`   settle tx: ${txHash}`);
  } finally {
    server.close();
  }
}

main().catch(e => { console.error('\n❌ e2e FAIL:', e); process.exit(1); });
