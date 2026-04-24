/**
 * Pre-flight: verify everything is ready BEFORE spending gas on registration or execution.
 * Exits 0 if green, 1 if any check fails.
 */
import 'dotenv/config';
import { ethers } from 'ethers';

const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const REGISTRY_ADDR = '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4';
const ESCROW_ADDR = '0xe2841b105B695610f2c1194f8865474A536184dB';
const ORACLE_URL = (process.env.ORACLE_URL || 'http://localhost:3001').replace(/\/$/, '');

const REGISTRY_ABI = ['function skillCount() view returns (uint256)'];
const ESCROW_ABI = ['function TIMEOUT() view returns (uint256)'];

const checks = [];
let failed = 0;

function pass(name, detail = '') { checks.push({ name, ok: true, detail }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); failed++; }

async function main() {
  // 1. PRIVATE_KEY
  if (!process.env.PRIVATE_KEY) {
    fail('PRIVATE_KEY env', 'not set — cannot sign any transactions');
    return report();
  }
  pass('PRIVATE_KEY env', 'set');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // 2. RPC reachable
  try {
    const block = await provider.getBlockNumber();
    if (block > 0) pass('RPC reachable', `block #${block}`);
    else fail('RPC reachable', `got block ${block}`);
  } catch (e) {
    fail('RPC reachable', `${RPC_URL}: ${e.message}`);
    return report();
  }

  // 3. Deployer wallet balance
  const balWei = await provider.getBalance(wallet.address);
  const balA0GI = Number(ethers.formatEther(balWei));
  if (balA0GI < 0.01) {
    fail('Deployer balance', `${balA0GI} A0GI — need ≥0.05 for 30 executions. Fund ${wallet.address}`);
  } else if (balA0GI < 0.05) {
    pass('Deployer balance', `${balA0GI} A0GI — low but sufficient. Funding ${wallet.address} recommended.`);
  } else {
    pass('Deployer balance', `${balA0GI} A0GI`);
  }

  // 4. Oracle API
  let oracleWallet = null;
  try {
    const res = await fetch(`${ORACLE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(`/health returned ok=false`);
    oracleWallet = data.wallet;
    pass('Oracle API /health', `${ORACLE_URL} — wallet ${oracleWallet}`);
  } catch (e) {
    fail('Oracle API /health', `${ORACLE_URL}: ${e.message}. Start oracle with: cd oracle && node src/index.js`);
  }

  // 5. Oracle wallet balance
  if (oracleWallet) {
    const oBal = Number(ethers.formatEther(await provider.getBalance(oracleWallet)));
    if (oBal < 0.01) {
      fail('Oracle wallet balance', `${oBal} A0GI — oracle needs gas to confirm executions. Fund ${oracleWallet}`);
    } else {
      pass('Oracle wallet balance', `${oBal} A0GI`);
    }
  }

  // 6. Contracts reachable
  try {
    const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, provider);
    const count = await registry.skillCount();
    pass('Registry V2', `${REGISTRY_ADDR} — ${count} skills currently`);
  } catch (e) {
    fail('Registry V2', `${REGISTRY_ADDR}: ${e.message}`);
  }

  try {
    const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, provider);
    const timeout = await escrow.TIMEOUT();
    pass('Escrow V2', `${ESCROW_ADDR} — TIMEOUT ${timeout}s`);
  } catch (e) {
    fail('Escrow V2', `${ESCROW_ADDR}: ${e.message}`);
  }

  report();
}

function report() {
  console.log('\n=== Pre-flight Report ===');
  for (const c of checks) {
    const icon = c.ok ? '✅' : '❌';
    console.log(`${icon} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }
  console.log(failed === 0 ? '\n✅ preflight OK\n' : `\n❌ ${failed} check(s) failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
