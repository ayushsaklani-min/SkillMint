/**
 * Example: Execute a skill on SkillMint
 *
 * This is the core agent flow:
 * 1. Agent finds a skill
 * 2. Agent pays escrow (on-chain tx)
 * 3. Oracle runs the skill in TEE hardware
 * 4. Agent gets the verified result
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/execute.ts
 */
import { SkillMintClient } from "../src/index.js";

const sm = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
});

async function main() {
  const SKILL_ID = 1; // Change to the skill you want to execute
  const INPUT = "Analyze this Solidity code for reentrancy vulnerabilities";

  console.log(`Wallet: ${sm.address}`);
  console.log(`Balance: ${await sm.getBalance()} A0GI\n`);

  // 1. Check the skill
  const skill = await sm.getSkill(SKILL_ID);
  console.log(`Executing: ${skill.metadata.name} (#${skill.id})`);
  console.log(`Price: ${skill.price} A0GI`);
  console.log(`Model: ${skill.model}\n`);

  // 2. Fire-and-forget: just pay and get execution ID
  console.log("Sending execution request...");
  const request = await sm.execute(SKILL_ID, INPUT);
  console.log(`Execution ID: ${request.executionId}`);
  console.log(`TX: ${sm.txUrl(request.txHash)}`);
  console.log(`Paid: ${request.amount} A0GI\n`);

  // 3. Poll for result (alternative to executeAndWait)
  console.log("Waiting for oracle to confirm...");
  let settled = false;
  let attempts = 0;
  while (!settled && attempts < 60) {
    const exec = await sm.getExecution(request.executionId);
    if (exec.settled) {
      settled = true;
      console.log("\nExecution confirmed!");
      console.log(`Payee: ${exec.payeeAtFunding}`);
      break;
    }
    if (exec.refunded) {
      console.log("\nExecution was refunded!");
      break;
    }
    attempts++;
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write(".");
  }

  if (!settled) {
    console.log("\nTimed out waiting for oracle. You can request a refund.");
    const refundTx = await sm.refund(request.executionId);
    console.log(`Refund TX: ${sm.txUrl(refundTx)}`);
  }
}

main().catch(console.error);
