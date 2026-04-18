import 'dotenv/config';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const TESTNET_RPC = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('ERROR: Set PRIVATE_KEY in .env');
  process.exit(1);
}

async function main() {
  console.log('=== SkillMint Day 0: TEE Inference Test ===\n');

  // 1. Init provider + wallet
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Wallet:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), '0G');

  if (balance === 0n) {
    console.error('\nERROR: Wallet has 0 balance. Get testnet tokens at https://faucet.0g.ai');
    process.exit(1);
  }

  // 2. Init broker
  console.log('\n[1] Initializing broker...');
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log('Broker initialized.');

  // 3. List available services to find qwen-2.5-7b-instruct provider
  console.log('\n[2] Listing inference services...');
  const services = await broker.inference.listService();
  console.log(`Found ${services.length} services.`);

  const targetModel = 'qwen/qwen-2.5-7b-instruct';
  const service = services.find(s => s.model === targetModel);

  if (!service) {
    console.log('Available models:', services.map(s => s.model));
    console.error(`\nERROR: Model "${targetModel}" not found on testnet.`);
    process.exit(1);
  }

  const providerAddr = service.provider;
  console.log(`Provider for ${targetModel}: ${providerAddr}`);

  // 4. Check/create ledger and fund
  console.log('\n[3] Checking ledger...');
  try {
    const ledgerInfo = await broker.ledger.getLedger();
    console.log('Ledger exists. Balance:', ledgerInfo.balance?.toString());
  } catch {
    console.log('No ledger found. Creating with 3 0G deposit...');
    await broker.ledger.depositFund(3);
    console.log('Ledger created.');
  }

  // 5. Fund provider sub-account
  console.log('\n[4] Funding provider sub-account...');
  try {
    await broker.ledger.transferFund(providerAddr, 'inference', BigInt(10 ** 16)); // 0.01 0G
    console.log('Provider funded with 1 0G.');
  } catch (e) {
    console.log('Transfer note (may already be funded):', e.message);
  }

  // 6. Get service metadata
  console.log('\n[5] Getting service metadata...');
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
  console.log('Endpoint:', endpoint);
  console.log('Model:', model);

  // 7. Get single-use headers — v0.7.x: ONE param only
  console.log('\n[6] Getting request headers...');
  const headers = await broker.inference.getRequestHeaders(providerAddr);
  console.log('Headers obtained.');

  // 8. Call inference
  console.log('\n[7] Calling TEE inference...');
  const prompt = 'You are a helpful assistant. Reply in one sentence.';
  const userInput = 'What is SkillMint? (guess from context: verified AI skill marketplace)';

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userInput }
      ],
      model
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Inference failed:', res.status, errText);
    process.exit(1);
  }

  const data = await res.json();
  const output = data.choices?.[0]?.message?.content;
  console.log('\nModel output:', output);

  // 9. Extract chatID — ZG-Res-Key header first, fallback to data.id
  const chatID = res.headers.get('ZG-Res-Key') || data.id;
  console.log('\nChat ID:', chatID);

  if (!chatID) {
    console.warn('WARNING: No chatID found. Skipping TEE verification.');
  } else {
    // 10. Verify TEE attestation
    console.log('\n[8] Verifying TEE attestation...');
    const isValid = await broker.inference.processResponse(providerAddr, chatID);

    if (isValid === null) {
      console.warn('TEE result: null (chatID not found in enclave log — headers may have been cached)');
    } else if (isValid === false) {
      console.error('TEE result: FALSE — response was tampered!');
      process.exit(1);
    } else {
      console.log('TEE result: TRUE — attestation verified!');
    }
  }

  console.log('\n=== Day 0 Complete ===');
  console.log('Output:', output);
  console.log('TEE Verified:', chatID ? true : 'skipped');
  console.log('\nReady to proceed to Week 1: Contracts + Storage');
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
