/**
 * Example: Manage your Skill NFTs
 *
 * As an NFT owner you can:
 * - Update price
 * - Activate/deactivate
 * - Transfer the NFT (revenue follows the owner)
 * - Withdraw earned revenue
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/manage.ts
 */
import { SkillMintClient } from "../src/index.js";

const sm = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
});

async function main() {
  console.log(`Wallet: ${sm.address}`);
  console.log(`Balance: ${await sm.getBalance()} A0GI`);
  console.log(`Skills owned: ${await sm.getOwnedSkillCount()}\n`);

  // Check pending revenue
  const revenue = await sm.getPendingRevenue();
  console.log(`Pending revenue: ${revenue.pending} A0GI`);

  if (revenue.pendingWei > 0n) {
    console.log("Withdrawing revenue...");
    const tx = await sm.withdrawRevenue();
    console.log(`Withdrawn! TX: ${sm.txUrl(tx)}`);
  }

  // Example: Mint a new skill
  console.log("\nMinting a new skill NFT...");
  const result = await sm.registerSkill({
    name: "Code Reviewer",
    description: "Reviews code for bugs, security issues, and best practices",
    systemPrompt:
      "You are an expert code reviewer. Analyze the provided code and return a JSON object with: {issues: [{severity, line, description}], summary: string, score: number}",
    computeProvider: "0xa48f01287233509FD694a22Bf840225062E67836",
    model: "qwen/qwen-2.5-7b-instruct",
    price: "0.001",
  });
  console.log(`Minted! Skill #${result.skillId}`);
  console.log(`TX: ${sm.txUrl(result.txHash)}`);
  console.log(`NFT Owner: ${result.owner}`);

  // Example: Update price
  console.log(`\nUpdating price of Skill #${result.skillId} to 0.002 A0GI...`);
  const updateTx = await sm.updatePrice(result.skillId, "0.002");
  console.log(`Updated! TX: ${sm.txUrl(updateTx)}`);

  // Example: Transfer NFT (commented out - uncomment to test)
  // const BUYER = "0x...";
  // console.log(`\nTransferring Skill #${result.skillId} to ${BUYER}...`);
  // const transferTx = await sm.transferSkill(result.skillId, BUYER);
  // console.log(`Transferred! TX: ${sm.txUrl(transferTx)}`);
  // console.log("The new owner now earns revenue from every execution.");
}

main().catch(console.error);
