/**
 * Example: Discover skills on SkillMint
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/discover.ts
 */
import { SkillMintClient } from "../src/index.js";

const sm = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
});

async function main() {
  console.log(`Wallet: ${sm.address}`);
  console.log(`Balance: ${await sm.getBalance()} A0GI\n`);

  // List all skills
  const skills = await sm.listSkills();
  console.log(`Found ${skills.length} skills on-chain:\n`);

  for (const skill of skills) {
    console.log(`  #${skill.id} ${skill.metadata.name || "Unnamed"}`);
    console.log(`     Model: ${skill.model}`);
    console.log(`     Price: ${skill.price} A0GI`);
    console.log(`     Owner: ${skill.owner}`);
    console.log(`     Reputation: ${skill.successfulExecutions}/${skill.executionCount} (${skill.successRate}%)`);
    console.log(`     Active: ${skill.active}`);
    console.log();
  }

  // Search for a specific skill
  const results = await sm.searchSkills("audit");
  console.log(`Search "audit": ${results.length} results`);
  for (const s of results) {
    console.log(`  - #${s.id} ${s.metadata.name}`);
  }
}

main().catch(console.error);
