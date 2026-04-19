/**
 * Example: Using SkillMint as a LangChain-style tool
 *
 * Shows how an AI agent framework can use SkillMint skills
 * as callable tools in an agent pipeline.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/agent-langchain.ts
 */
import { SkillMintClient } from "../src/index.js";

const sm = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
});

/**
 * Create a LangChain-compatible tool definition from a SkillMint skill.
 * This bridges SkillMint into any agent framework.
 */
async function createSkillTool(skillId: number) {
  const skill = await sm.getSkill(skillId);

  return {
    name: skill.metadata.name?.replace(/\s+/g, "_").toLowerCase() || `skill_${skillId}`,
    description: skill.metadata.description || `SkillMint Skill #${skillId}`,
    inputSchema: skill.metadata.inputSchema || { type: "object", properties: { input: { type: "string" } } },

    /** Call this from your agent framework */
    async invoke(input: string): Promise<{ executionId: string; txHash: string; amount: string }> {
      console.log(`[SkillMint] Executing ${skill.metadata.name} (#${skillId})...`);
      console.log(`[SkillMint] Price: ${skill.price} A0GI`);

      const result = await sm.execute(skillId, input);

      console.log(`[SkillMint] Execution ID: ${result.executionId}`);
      console.log(`[SkillMint] TX: ${sm.txUrl(result.txHash)}`);

      return result;
    },
  };
}

async function main() {
  console.log("=== SkillMint Agent Integration ===\n");
  console.log(`Agent wallet: ${sm.address}`);
  console.log(`Balance: ${await sm.getBalance()} A0GI\n`);

  // Discover available tools
  const skills = await sm.listSkills();
  console.log(`Available skills (${skills.length}):`);
  for (const s of skills) {
    console.log(`  - ${s.metadata.name} (#${s.id}) — ${s.price} A0GI — ${s.model}`);
  }

  // Create tool from first active skill
  const activeSkill = skills.find((s) => s.active);
  if (!activeSkill) {
    console.log("\nNo active skills found.");
    return;
  }

  console.log(`\nCreating tool from: ${activeSkill.metadata.name} (#${activeSkill.id})`);
  const tool = await createSkillTool(activeSkill.id);

  console.log(`\nTool ready:`);
  console.log(`  Name: ${tool.name}`);
  console.log(`  Description: ${tool.description}`);

  // Simulate agent calling the tool
  // In a real LangChain/CrewAI setup, the agent framework would call tool.invoke()
  // console.log("\nAgent invoking tool...");
  // const result = await tool.invoke("Review this smart contract for security issues");
  // console.log("Result:", result);
}

main().catch(console.error);
