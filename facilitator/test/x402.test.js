import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { validateShape, verifyEip3009Signature, decodePaymentHeader, encodePaymentHeader } from '../src/x402.js';
import { buildPaymentPayload } from '../src/client.js';

const NETWORK = '0g-testnet';
const CHAIN_ID = 16602n;
const W0G = '0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D';
const PAY_TO = '0x000000000000000000000000000000000000dEaD';
const VALUE = ethers.parseEther('0.001');

function makeRequirements(overrides = {}) {
  return {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: VALUE.toString(),
    resource: 'https://oracle.example/skill/15/execute',
    description: 'Test',
    mimeType: 'application/json',
    payTo: PAY_TO,
    maxTimeoutSeconds: 300,
    asset: W0G,
    extra: { name: 'Wrapped 0G', version: '1' },
    ...overrides,
  };
}

async function makePayload(signer, overrides = {}) {
  return buildPaymentPayload({
    signer,
    network: NETWORK,
    asset: W0G,
    assetName: 'Wrapped 0G',
    assetVersion: '1',
    chainId: CHAIN_ID,
    from: signer.address,
    to: PAY_TO,
    value: VALUE,
    ...overrides,
  });
}

test('validateShape accepts a well-formed payload/requirements pair', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  const pr = makeRequirements();
  assert.deepEqual(validateShape(pp, pr), { ok: true });
});

test('validateShape rejects network mismatch', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  const pr = makeRequirements({ network: '0g-mainnet' });
  const r = validateShape(pp, pr);
  assert.equal(r.ok, false);
  assert.match(r.reason, /network/);
});

test('validateShape rejects value below maxAmountRequired', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer, { value: VALUE / 2n });
  const pr = makeRequirements();
  const r = validateShape(pp, pr);
  assert.equal(r.ok, false);
  assert.match(r.reason, /value/);
});

test('validateShape rejects wrong scheme', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  pp.scheme = 'upto';
  const r = validateShape(pp, makeRequirements());
  assert.equal(r.ok, false);
});

test('verifyEip3009Signature recovers the signer correctly', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  const r = verifyEip3009Signature({
    authorization: pp.payload.authorization,
    signature:     pp.payload.signature,
    asset:         W0G,
    network:       NETWORK,
    assetName:     'Wrapped 0G',
    assetVersion:  '1',
  });
  assert.deepEqual(r, { ok: true });
});

test('verifyEip3009Signature rejects a tampered value', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  const tampered = { ...pp.payload.authorization, value: (VALUE * 2n).toString() };
  const r = verifyEip3009Signature({
    authorization: tampered,
    signature:     pp.payload.signature,
    asset:         W0G,
    network:       NETWORK,
    assetName:     'Wrapped 0G',
    assetVersion:  '1',
  });
  assert.equal(r.ok, false);
});

test('verifyEip3009Signature rejects wrong chainId / network', async () => {
  const signer = ethers.Wallet.createRandom();
  // Sign against mainnet domain but verify against testnet
  const pp = await buildPaymentPayload({
    signer,
    network: '0g-mainnet',
    asset: W0G,
    assetName: 'Wrapped 0G',
    assetVersion: '1',
    chainId: 16661n,
    from: signer.address,
    to: PAY_TO,
    value: VALUE,
  });
  const r = verifyEip3009Signature({
    authorization: pp.payload.authorization,
    signature:     pp.payload.signature,
    asset:         W0G,
    network:       '0g-testnet',
    assetName:     'Wrapped 0G',
    assetVersion:  '1',
  });
  assert.equal(r.ok, false);
});

test('encode/decode X-PAYMENT header round-trips', async () => {
  const signer = ethers.Wallet.createRandom();
  const pp = await makePayload(signer);
  const header = encodePaymentHeader(pp);
  const decoded = decodePaymentHeader(header);
  assert.deepEqual(decoded, pp);
});
