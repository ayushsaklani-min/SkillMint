// Browser x402 client for SkillMint.
//
// Mirrors sdk/src/client.ts: probe → 402 → sign EIP-3009 → resend with
// X-PAYMENT → receive output (JSON for prompt skills, application/zip for
// agent-skill downloads). Browser-only helpers — uses Web Crypto + btoa
// instead of node's Buffer/createHash.

import { ethers, BrowserProvider, Contract } from "ethers";
import { NETWORK, W0G_ABI } from "./contracts";

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: { name?: string; version?: string };
};

export type PaymentPayload = {
  x402Version: 1;
  scheme: "exact";
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string; to: string; value: string;
      validAfter: string; validBefore: string; nonce: string;
    };
  };
};

/** Hex sha256 of a Uint8Array, "0x"-prefixed (matches the oracle convention). */
export async function sha256HexBrowser(bytes: Uint8Array): Promise<string> {
  // Force a fresh ArrayBuffer-backed view so the lib.dom typings accept it.
  const ab = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", ab);
  return "0x" + Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Base64-encode a string (browser-safe). For binary use base64FromBytes. */
export function base64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function base64DecodeUtf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

async function probeChallenge(skillId: number, body: object): Promise<PaymentRequirements> {
  const res = await fetch(`/api/x402/skill/${skillId}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 402) {
    throw new Error(`x402 probe: expected 402, got ${res.status}`);
  }
  const j = (await res.json()) as { accepts?: PaymentRequirements[] };
  const r = j.accepts?.[0];
  if (!r) throw new Error("x402 probe: no paymentRequirements in 402 body");
  if (r.asset.toLowerCase() !== NETWORK.w0g.toLowerCase()) {
    throw new Error(`x402 probe: asset ${r.asset} != frontend W0G ${NETWORK.w0g}`);
  }
  return r;
}

/** Ensure the connected wallet has at least `need` W0G; auto-wraps native 0G. */
async function ensureW0G(provider: BrowserProvider, address: string, need: bigint): Promise<void> {
  const w0g = new Contract(NETWORK.w0g, W0G_ABI, provider);
  const bal: bigint = await w0g.balanceOf(address);
  if (bal >= need) return;
  const signer = await provider.getSigner();
  const w0gWrite = new Contract(NETWORK.w0g, W0G_ABI, signer);
  const short = need - bal + ethers.parseEther("0.0005");
  const tx = await w0gWrite.deposit({ value: short });
  await tx.wait();
}

async function signPaymentAuthorization(
  provider: BrowserProvider,
  requirements: PaymentRequirements
): Promise<PaymentPayload> {
  const signer = await provider.getSigner();
  const from = await signer.getAddress();
  const now = Math.floor(Date.now() / 1000);
  const validBefore = now + 600;
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const authorization = {
    from,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: "0",
    validBefore: String(validBefore),
    nonce,
  };

  const domain = {
    name: requirements.extra?.name || "Wrapped 0G",
    version: requirements.extra?.version || "1",
    chainId: BigInt(NETWORK.chainId),
    verifyingContract: requirements.asset,
  };
  const types = {
    TransferWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  };
  const signature = await signer.signTypedData(domain, types, {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce,
  });

  return {
    x402Version: 1,
    scheme: "exact",
    network: requirements.network,
    payload: { signature, authorization },
  };
}

export type AgentSkillDownload = {
  bundle: Uint8Array;
  bundleSha256: string;
  manifest: string[];
  receiptRootHash: string;
  settlement: { transaction: string; network: string; payer: string; blockNumber?: number };
  paidW0G: string;
};

/**
 * Buy and download an agent-skill bundle in the browser. Auto-wraps W0G if
 * needed, signs EIP-3009, sha256-verifies the bytes against the X-Bundle-Sha256
 * header.
 */
export async function downloadAgentSkillBrowser(
  provider: BrowserProvider,
  skillId: number
): Promise<AgentSkillDownload> {
  const address = await (await provider.getSigner()).getAddress();
  const requirements = await probeChallenge(skillId, {});
  const need = BigInt(requirements.maxAmountRequired);
  await ensureW0G(provider, address, need);

  const payment = await signPaymentAuthorization(provider, requirements);
  const header = base64Utf8(JSON.stringify(payment));

  const r = await fetch(`/api/x402/skill/${skillId}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment": header },
    body: "{}",
  });
  if (r.status !== 200) {
    let body = "";
    try { body = await r.text(); } catch { /* ignore */ }
    throw new Error(`download: ${r.status} ${body.slice(0, 400)}`);
  }
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/zip")) {
    throw new Error(`download: unexpected content-type "${ct}" — server returned a non-zip payload`);
  }
  const bundle = new Uint8Array(await r.arrayBuffer());

  const expected = (r.headers.get("x-bundle-sha256") || "").toLowerCase();
  const observed = await sha256HexBrowser(bundle);
  if (expected && expected !== observed) {
    throw new Error(`sha256 mismatch — server claimed ${expected} but bundle hashes to ${observed}`);
  }

  let manifest: string[] = [];
  try {
    const b64 = r.headers.get("x-manifest");
    if (b64) manifest = JSON.parse(base64DecodeUtf8(b64));
  } catch { /* keep empty */ }

  let settlement = { transaction: "", network: requirements.network, payer: address };
  const sb64 = r.headers.get("x-payment-response");
  if (sb64) {
    try { settlement = JSON.parse(base64DecodeUtf8(sb64)); } catch { /* keep defaults */ }
  }

  return {
    bundle,
    bundleSha256: observed,
    manifest,
    receiptRootHash: r.headers.get("x-receipt-root") || "",
    settlement,
    paidW0G: ethers.formatEther(need),
  };
}

/** Browser-side trigger to save bytes as a file via a temp Blob URL. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime = "application/zip") {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
