// x402 v1 payload shapes + EIP-3009 verification helpers.
// Decoupled from HTTP so /verify, /settle, and unit tests all reuse it.

import { ethers } from 'ethers';

export const SUPPORTED_NETWORKS = {
  '0g-testnet': 16602n,
  '0g-mainnet': 16661n,
};

export const SCHEME = 'exact';

// Exhaustive validation of an x402 v1 payload + requirements pair.
// Returns { ok: true } or { ok: false, reason: string }.
export function validateShape(paymentPayload, paymentRequirements) {
  if (!paymentPayload || typeof paymentPayload !== 'object') return fail('payload missing');
  if (!paymentRequirements || typeof paymentRequirements !== 'object') return fail('requirements missing');
  if (paymentPayload.x402Version !== 1) return fail(`x402Version must be 1`);
  if (paymentPayload.scheme !== SCHEME) return fail(`scheme must be "${SCHEME}"`);
  if (paymentRequirements.scheme !== SCHEME) return fail(`requirements.scheme must be "${SCHEME}"`);
  if (paymentPayload.network !== paymentRequirements.network) return fail('network mismatch');
  if (!(paymentRequirements.network in SUPPORTED_NETWORKS)) return fail(`unsupported network ${paymentRequirements.network}`);
  const a = paymentPayload.payload?.authorization;
  if (!a) return fail('authorization missing');
  for (const k of ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']) {
    if (a[k] === undefined || a[k] === null) return fail(`authorization.${k} missing`);
  }
  if (!paymentPayload.payload.signature) return fail('signature missing');
  if (!paymentRequirements.asset) return fail('requirements.asset missing');
  if (!paymentRequirements.payTo) return fail('requirements.payTo missing');
  if (!paymentRequirements.maxAmountRequired) return fail('requirements.maxAmountRequired missing');

  // Requirements match payload
  if (a.to.toLowerCase() !== paymentRequirements.payTo.toLowerCase()) return fail('to != payTo');
  const value = BigInt(a.value);
  const maxReq = BigInt(paymentRequirements.maxAmountRequired);
  if (value < maxReq) return fail(`value ${value} < required ${maxReq}`);

  return { ok: true };
}

function fail(reason) { return { ok: false, reason }; }

// Verifies an EIP-3009 `TransferWithAuthorization` signature against the W0G
// contract's EIP-712 domain. Returns { ok, reason? }.
export function verifyEip3009Signature({ authorization, signature, asset, network, assetName, assetVersion }) {
  const chainId = SUPPORTED_NETWORKS[network];
  if (!chainId) return fail(`unknown network ${network}`);

  const domain = {
    name: assetName,
    version: assetVersion,
    chainId,
    verifyingContract: asset,
  };
  const types = {
    TransferWithAuthorization: [
      { name: 'from',        type: 'address' },
      { name: 'to',          type: 'address' },
      { name: 'value',       type: 'uint256' },
      { name: 'validAfter',  type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce',       type: 'bytes32' },
    ],
  };
  const msg = {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce,
  };
  let recovered;
  try {
    recovered = ethers.verifyTypedData(domain, types, msg, signature);
  } catch (e) {
    return fail(`signature decode: ${e.message}`);
  }
  if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
    return fail(`recovered ${recovered} != from ${authorization.from}`);
  }
  return { ok: true };
}

// Decode a base64-encoded X-PAYMENT header into a paymentPayload object.
export function decodePaymentHeader(header) {
  if (!header) throw new Error('X-PAYMENT header missing');
  const json = Buffer.from(header, 'base64').toString('utf8');
  return JSON.parse(json);
}

export function encodePaymentHeader(paymentPayload) {
  return Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString('base64');
}
