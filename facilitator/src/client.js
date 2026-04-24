// Agent-side helper: sign an EIP-3009 authorization and build an x402 payload.
// Used by skills/x402-client.js and by the facilitator's own e2e test.

import { ethers } from 'ethers';

export async function buildPaymentPayload({ signer, network, asset, assetName, assetVersion, chainId, from, to, value, validAfter = 0, validBeforeSeconds = 600 }) {
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + validBeforeSeconds;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

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
  const authorization = {
    from, to,
    value: value.toString(),
    validAfter: String(validAfter),
    validBefore: String(validBefore),
    nonce,
  };
  const signature = await signer.signTypedData(domain, types, {
    ...authorization,
    value: BigInt(value),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
  });

  return {
    x402Version: 1,
    scheme: 'exact',
    network,
    payload: { signature, authorization },
  };
}
