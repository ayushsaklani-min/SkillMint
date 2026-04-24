/**
 * Example: Execute a SkillMint skill via an x402 HTTP endpoint (W0G payment).
 *
 * Three SDK calls — the defaults already point at the hosted testnet x402
 * endpoint, so no URL override is required.
 *
 * Usage:
 *   PRIVATE_KEY=0x... SKILL_ID=15 npx tsx examples/x402-agent.ts
 *   (pass X402_URL=... to target a self-hosted x402 server)
 */
import { SkillMintClient } from "../src/index.js";

const sm = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
  x402Url: process.env.X402_URL, // optional override
});

async function main() {
  const SKILL_ID = Number(process.env.SKILL_ID || "15");
  const INPUT =
    process.argv[2] ||
    "pragma solidity ^0.8.0; contract Vulnerable { mapping(address=>uint) balances; function withdraw() public { (bool s,) = msg.sender.call{value: balances[msg.sender]}(''); balances[msg.sender] = 0; } }";

  console.log(`Agent  : ${sm.address}`);
  console.log(`A0GI   : ${await sm.getBalance()}`);
  console.log(`W0G    : ${await sm.getW0GBalance()}`);
  console.log(`Skill  : #${SKILL_ID} @ ${sm.x402Url}\n`);

  // 1. Pay + run — SDK handles probe, auto-wrap, sign, retry
  console.log("[1] client.executeX402()");
  const res = await sm.executeX402(SKILL_ID, INPUT);
  console.log(`    settle tx : ${res.settlement.transaction}`);
  console.log(`    receipt   : ${res.receiptRootHash}`);
  console.log(`    paidW0G   : ${res.paidW0G}`);
  console.log(`    output    : ${(res.output || "").slice(0, 120)}${(res.output || "").length > 120 ? "…" : ""}\n`);

  // 2. Fetch the receipt from 0G Storage
  console.log("[2] client.fetchReceipt()");
  let receipt;
  try {
    receipt = await sm.fetchReceipt(res.receiptRootHash);
    console.log(`    teeVerified=${receipt.teeVerified} chatID=${receipt.chatID}`);
  } catch (e) {
    console.log(`    ⚠ indexer fetch unavailable in this environment: ${(e as Error).message}`);
    console.log(`    (browser/SDK environments with a Storage gateway can use this; skipping verify)`);
    return;
  }

  // 3. Verify the receipt locally
  console.log("[3] client.verifyReceipt()");
  const v = sm.verifyReceipt(receipt);
  console.log(`    inputHashOk=${v.inputHashOk} outputHashOk=${v.outputHashOk} teeVerified=${v.teeVerified}`);
  console.log(v.valid ? "\n✅ receipt VALID" : "\n❌ receipt INVALID");
  if (!v.valid) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
