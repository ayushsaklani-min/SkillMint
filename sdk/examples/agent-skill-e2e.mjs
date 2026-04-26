/**
 * Live E2E for agent-skill flow on 0G Galileo testnet.
 *
 * Steps:
 *   1. Wallet A (PRIVATE_KEY) publishes the bundle at BUNDLE_PATH via SDK.
 *   2. Wallet B (BUYER_KEY, defaults to same wallet for self-test) downloads
 *      the bundle via x402, sha256-verifies it locally.
 *   3. Fetch the receipt from 0G Storage and re-verify against the bundle.
 *
 * Required env:
 *   PRIVATE_KEY  — publisher wallet (must own some W0G or A0GI on Galileo)
 *   BUYER_KEY    — buyer wallet; same as PRIVATE_KEY by default (self-buy ok)
 *   BUNDLE_PATH  — defaults to user's fhenix-dev.skill
 */
import fs from "node:fs";
import path from "node:path";
import { SkillMintClient } from "../dist/index.js";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY required"); process.exit(1); }
const BUYER_KEY = process.env.BUYER_KEY || PRIVATE_KEY;
const BUNDLE_PATH = process.env.BUNDLE_PATH || "C:/Users/sakla/Downloads/files (3)/fhenix-dev.skill";

console.log("=== Agent-Skill E2E (Galileo testnet) ===");
console.log(`Bundle      : ${BUNDLE_PATH}`);

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error(`bundle not found at ${BUNDLE_PATH}`);
  process.exit(1);
}
const bundleBytes = fs.readFileSync(BUNDLE_PATH);
console.log(`Bundle size : ${bundleBytes.length} B`);

// ─── Wallet A: publish ──────────────────────────────────────────────────────
const publisher = new SkillMintClient({ privateKey: PRIVATE_KEY, network: "testnet" });
console.log(`Publisher   : ${publisher.address}`);

console.log("\n[1] registerAgentSkill()");
const t0 = Date.now();
const reg = await publisher.registerAgentSkill({
  bundle: bundleBytes,
  name: "fhenix-dev",
  description: "Complete knowledge base for building on Fhenix (FHE blockchain). Smart contracts with encrypted state, FHERC20, decryption flows, hardhat plugin.",
  price: "0.001",  // W0G per download
  format: "claude-skill",
  compatibleWith: ["claude-code", "cursor", "codex"],
});
console.log(`  skillId   : #${reg.skillId}`);
console.log(`  txHash    : ${reg.txHash}`);
console.log(`  storage   : ${reg.bundleStorageRoot}`);
console.log(`  sha256    : ${reg.bundleSha256}`);
console.log(`  done in   : ${Date.now() - t0} ms`);

// ─── Verify on-chain metadata round-trip ────────────────────────────────────
console.log("\n[2] getSkill() — confirm metadata stored correctly");
const fetched = await publisher.getSkill(reg.skillId);
const meta = fetched.metadata;
console.log(`  kind          : ${meta.kind}`);
console.log(`  name          : ${meta.name}`);
console.log(`  bundleSha256  : ${meta.bundleSha256}`);
console.log(`  manifest len  : ${meta.manifest?.length}`);
console.log(`  active        : ${fetched.active}`);
if (meta.kind !== "agent-skill") { console.error("FAIL: expected kind=agent-skill"); process.exit(1); }
if (String(meta.bundleSha256).toLowerCase() !== String(reg.bundleSha256).toLowerCase()) {
  console.error("FAIL: on-chain bundleSha256 doesn't match what was registered");
  process.exit(1);
}

// ─── Wallet B: buy + download ──────────────────────────────────────────────
const buyer = new SkillMintClient({ privateKey: BUYER_KEY, network: "testnet" });
console.log(`\n[3] downloadAgentSkill(#${reg.skillId}) as ${buyer.address}`);
const t1 = Date.now();
const dl = await buyer.downloadAgentSkill(reg.skillId);
console.log(`  bytes received    : ${dl.bundle.length}`);
console.log(`  observed sha256   : ${dl.bundleSha256}`);
console.log(`  manifest          : [${dl.manifest.length}] ${dl.manifest.slice(0, 3).join(", ")}…`);
console.log(`  receipt root      : ${dl.receiptRootHash}`);
console.log(`  settle tx         : ${dl.settlement.transaction}`);
console.log(`  paid              : ${dl.paidW0G} W0G`);
console.log(`  done in           : ${Date.now() - t1} ms`);

if (dl.bundleSha256.toLowerCase() !== reg.bundleSha256.toLowerCase()) {
  console.error("FAIL: downloaded bundle sha256 doesn't match what was registered");
  process.exit(1);
}

// ─── Verify receipt off-chain ──────────────────────────────────────────────
console.log("\n[4] fetchReceipt() + verifyReceipt(bundle)");
const receipt = await buyer.fetchReceipt(dl.receiptRootHash);
console.log(`  receipt.kind        : ${receipt.kind}`);
console.log(`  receipt.skillId     : ${receipt.skillId}`);
console.log(`  receipt.bundleSha256: ${receipt.bundleSha256}`);
const v = buyer.verifyReceipt(receipt, { bundle: dl.bundle });
console.log(`  verification        :`, v);
if (!v.valid) { console.error("FAIL: receipt verification failed"); process.exit(1); }

// ─── Optional: extract for sanity ──────────────────────────────────────────
const outDir = path.join(process.cwd(), `_out_${reg.skillId}`);
fs.mkdirSync(outDir, { recursive: true });
const extractCheck = await buyer.downloadAgentSkill(reg.skillId, { extractTo: outDir });
console.log(`\n[5] Re-downloaded + extracted to ${outDir}`);
console.log(`  files extracted   : ${fs.readdirSync(outDir).join(", ")}`);
console.log(`  paid (2nd time)   : ${extractCheck.paidW0G} W0G  (per-download model is correct)`);

console.log("\n=== ✅ Agent-skill E2E PASS ===");
console.log(`Skill #${reg.skillId} live: name="${meta.name}", price=${fetched.price} W0G, owner=${fetched.owner}`);
