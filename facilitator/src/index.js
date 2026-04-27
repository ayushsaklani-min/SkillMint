import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_NETWORKS,
  SCHEME,
  validateShape,
  verifyEip3009Signature,
} from './x402.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W0G_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../shared/abis/W0G.json'), 'utf8'));

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.FACILITATOR_PORT || 3002);
const NETWORK = process.env.NETWORK || '0g-testnet';
const RPC_URL = process.env.RPC_URL || (NETWORK === '0g-mainnet'
  ? 'https://evmrpc.0g.ai'
  : 'https://evmrpc-testnet.0g.ai');
const W0G_ADDR = process.env.W0G_ADDRESS || (NETWORK === '0g-mainnet'
  ? '0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01'
  : '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D');

if (!(NETWORK in SUPPORTED_NETWORKS)) throw new Error(`unsupported NETWORK ${NETWORK}`);

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Facilitator wallet is optional for verify-only runs, required for /settle.
let wallet = null;
if (process.env.FACILITATOR_KEY) {
  wallet = new ethers.Wallet(process.env.FACILITATOR_KEY, provider);
}

const w0gRead  = new ethers.Contract(W0G_ADDR, W0G_ABI, provider);
const w0gWrite = wallet ? new ethers.Contract(W0G_ADDR, W0G_ABI, wallet) : null;

// ─── Core verify logic (pure; reused by /verify and /settle) ─────────────────
export async function verifyPayment(paymentPayload, paymentRequirements) {
  const shape = validateShape(paymentPayload, paymentRequirements);
  if (!shape.ok) return { isValid: false, invalidReason: shape.reason };

  if (paymentRequirements.asset.toLowerCase() !== W0G_ADDR.toLowerCase()) {
    return { isValid: false, invalidReason: `asset must be ${W0G_ADDR}` };
  }

  const auth = paymentPayload.payload.authorization;
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) <= now) return { isValid: false, invalidReason: 'authorization expired' };
  if (Number(auth.validAfter)  > now)  return { isValid: false, invalidReason: 'authorization not yet valid' };

  const sigCheck = verifyEip3009Signature({
    authorization: auth,
    signature:     paymentPayload.payload.signature,
    asset:         W0G_ADDR,
    network:       paymentRequirements.network,
    assetName:     paymentRequirements.extra?.name    || 'Wrapped 0G',
    assetVersion:  paymentRequirements.extra?.version || '1',
  });
  if (!sigCheck.ok) return { isValid: false, invalidReason: sigCheck.reason };

  // On-chain checks — balance + nonce unused
  const [balance, alreadyUsed] = await Promise.all([
    w0gRead.balanceOf(auth.from),
    w0gRead.authorizationState(auth.from, auth.nonce),
  ]);
  if (alreadyUsed) return { isValid: false, invalidReason: 'authorization nonce already used' };
  if (balance < BigInt(auth.value)) {
    return { isValid: false, invalidReason: `insufficient W0G balance: has ${balance}, needs ${auth.value}` };
  }
  return { isValid: true, payer: auth.from };
}

// ─── HTTP server ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use((req, _res, next) => {
  console.log(`[facilitator] ${req.method} ${req.url}`);
  next();
});

app.get('/health', async (_req, res) => {
  try {
    const block = await provider.getBlockNumber();
    const bal = wallet ? ethers.formatEther(await provider.getBalance(wallet.address)) : null;
    res.json({ ok: true, network: NETWORK, block, wallet: wallet?.address || null, walletBalance: bal });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get('/supported', (_req, res) => {
  res.json({
    kinds: [{
      x402Version: 1,
      scheme: SCHEME,
      network: NETWORK,
      asset: W0G_ADDR,
      assetName: 'Wrapped 0G',
      assetVersion: '1',
    }],
  });
});

app.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const out = await verifyPayment(paymentPayload, paymentRequirements);
    res.json(out);
  } catch (e) {
    console.error('[facilitator] /verify error:', e.message);
    res.status(500).json({ isValid: false, invalidReason: `server: ${e.message}` });
  }
});

app.post('/settle', async (req, res) => {
  if (!w0gWrite) return res.status(500).json({ success: false, error: 'facilitator wallet not configured' });
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const check = await verifyPayment(paymentPayload, paymentRequirements);
    if (!check.isValid) return res.json({ success: false, error: check.invalidReason });

    const a = paymentPayload.payload.authorization;
    const sig = ethers.Signature.from(paymentPayload.payload.signature);

    const tx = await w0gWrite.transferWithAuthorization(
      a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce,
      sig.v, sig.r, sig.s
    );
    const rcpt = await tx.wait();
    console.log(`[facilitator] settled ${a.from} → ${a.to} ${a.value} in ${tx.hash}`);
    res.json({
      success: true,
      transaction: tx.hash,
      network: paymentRequirements.network,
      payer: a.from,
      blockNumber: rcpt.blockNumber,
    });
  } catch (e) {
    console.error('[facilitator] /settle error:', e.message);
    res.status(502).json({ success: false, error: e.message });
  }
});

export function startFacilitator() {
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`[facilitator] listening on :${PORT} network=${NETWORK} w0g=${W0G_ADDR} wallet=${wallet?.address || '(none)'}`);
  });
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  startFacilitator();
}

export { app, W0G_ADDR, NETWORK };
