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

const ASSETS_BY_NETWORK = {
  '0g-testnet': {
    rpc: 'https://evmrpc-testnet.0g.ai',
    assets: (() => {
      const a = {};
      const w0g = (process.env.W0G_ADDRESS_TESTNET || '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D').toLowerCase();
      a[w0g] = { symbol: 'W0G', name: 'Wrapped 0G', version: '1', decimals: 18 };
      if (process.env.MOCK_USDC_ADDRESS) {
        a[process.env.MOCK_USDC_ADDRESS.toLowerCase()] = { symbol: 'USDC', name: 'Mock USDC', version: '1', decimals: 6 };
      }
      return a;
    })(),
  },
  '0g-mainnet': {
    rpc: 'https://evmrpc.0g.ai',
    assets: {
      '0x7f73a890f0f608fa32e1dd29a5f552bc7dda0e01': { symbol: 'W0G',    name: 'Wrapped 0G', version: '1', decimals: 18 },
      '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e': { symbol: 'USDC.E', name: 'USDC',       version: '2', decimals: 6  },
    },
  },
};

if (!(NETWORK in SUPPORTED_NETWORKS)) throw new Error(`unsupported NETWORK ${NETWORK}`);
if (!(NETWORK in ASSETS_BY_NETWORK)) throw new Error(`no asset config for NETWORK ${NETWORK}`);
const NETCFG = ASSETS_BY_NETWORK[NETWORK];
const RPC_URL = process.env.RPC_URL || NETCFG.rpc;
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Facilitator wallet is optional for verify-only runs, required for /settle.
let wallet = null;
if (process.env.FACILITATOR_KEY) {
  wallet = new ethers.Wallet(process.env.FACILITATOR_KEY, provider);
}

// Generic ERC-20 + EIP-3009 ABI works for both W0G and USDC.E
const ERC20_3009_ABI = W0G_ABI;

function readContractFor(addr) {
  return new ethers.Contract(addr, ERC20_3009_ABI, provider);
}
function writeContractFor(addr) {
  if (!wallet) return null;
  return new ethers.Contract(addr, ERC20_3009_ABI, wallet);
}

// ─── Core verify logic (pure; reused by /verify and /settle) ─────────────────
export async function verifyPayment(paymentPayload, paymentRequirements) {
  const shape = validateShape(paymentPayload, paymentRequirements);
  if (!shape.ok) return { isValid: false, invalidReason: shape.reason };

  const assetAddr = paymentRequirements.asset.toLowerCase();
  const assetCfg = NETCFG.assets[assetAddr];
  if (!assetCfg) {
    return { isValid: false, invalidReason: `unknown asset ${paymentRequirements.asset} for network ${NETWORK}` };
  }

  const auth = paymentPayload.payload.authorization;
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) <= now) return { isValid: false, invalidReason: 'authorization expired' };
  if (Number(auth.validAfter)  > now)  return { isValid: false, invalidReason: 'authorization not yet valid' };

  const sigCheck = verifyEip3009Signature({
    authorization: auth,
    signature:     paymentPayload.payload.signature,
    asset:         paymentRequirements.asset,
    network:       paymentRequirements.network,
    assetName:     paymentRequirements.extra?.name    || assetCfg.name,
    assetVersion:  paymentRequirements.extra?.version || assetCfg.version,
  });
  if (!sigCheck.ok) return { isValid: false, invalidReason: sigCheck.reason };

  const tokenRead = readContractFor(paymentRequirements.asset);
  const [balance, alreadyUsed] = await Promise.all([
    tokenRead.balanceOf(auth.from),
    tokenRead.authorizationState(auth.from, auth.nonce),
  ]);
  if (alreadyUsed) return { isValid: false, invalidReason: 'authorization nonce already used' };
  if (balance < BigInt(auth.value)) {
    return { isValid: false, invalidReason: `insufficient ${assetCfg.symbol} balance: has ${balance}, needs ${auth.value}` };
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
    const assets = Object.entries(NETCFG.assets).map(([addr, cfg]) => ({ address: ethers.getAddress(addr), symbol: cfg.symbol }));
    res.json({ ok: true, network: NETWORK, block, wallet: wallet?.address || null, walletBalance: bal, assets });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get('/supported', (_req, res) => {
  const kinds = Object.entries(NETCFG.assets).map(([addr, cfg]) => ({
    x402Version: 1,
    scheme: SCHEME,
    network: NETWORK,
    asset: ethers.getAddress(addr),
    assetName: cfg.name,
    assetVersion: cfg.version,
  }));
  res.json({ kinds });
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
  if (!wallet) return res.status(500).json({ success: false, error: 'facilitator wallet not configured' });
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const check = await verifyPayment(paymentPayload, paymentRequirements);
    if (!check.isValid) return res.json({ success: false, error: check.invalidReason });

    const tokenWrite = writeContractFor(paymentRequirements.asset);
    if (!tokenWrite) return res.status(500).json({ success: false, error: 'cannot resolve write contract for asset' });

    const a = paymentPayload.payload.authorization;
    const sig = ethers.Signature.from(paymentPayload.payload.signature);
    const tx = await tokenWrite.transferWithAuthorization(
      a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce,
      sig.v, sig.r, sig.s
    );
    const rcpt = await tx.wait();
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
    const assets = Object.entries(NETCFG.assets).map(([a,c]) => `${c.symbol}=${a}`).join(', ');
    console.log(`[facilitator] listening on :${PORT} network=${NETWORK} assets=[${assets}] wallet=${wallet?.address || '(none)'}`);
  });
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  startFacilitator();
}

export { app, NETWORK, NETCFG };
