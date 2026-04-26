/**
 * Publishes the Fhenix knowledge bundle as a TEE prompt-skill.
 *
 * Concatenates SKILL.md + references/*.md from the Fhenix bundle into
 * one system prompt, registers it via SDK as a normal prompt-skill so
 * the source never leaves the TEE — buyers pay per query and only get
 * the model's answer back.
 */
import fs from "node:fs";
import path from "node:path";
import { SkillMintClient } from "@skillmint/sdk";

const BUNDLE_DIR = "C:/Users/sakla/Downloads/files (3)";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY required"); process.exit(1); }

// 1. Concat the markdown files into one system prompt.
const files = ["SKILL.md", "architecture.md", "client-sdk.md",
               "quickstart-and-setup.md", "smart-contracts.md",
               "tutorials-and-examples.md"];
const sections = [];
for (const f of files) {
  const p = path.join(BUNDLE_DIR, f);
  if (!fs.existsSync(p)) { console.error(`missing: ${p}`); process.exit(1); }
  sections.push(`\n\n=== ${f} ===\n\n` + fs.readFileSync(p, "utf8"));
}
const knowledge = sections.join("");

const systemPrompt = `You are a Fhenix Development Expert — an authoritative assistant for builders shipping on Fhenix, the Fully Homomorphic Encryption (FHE) blockchain.

You have full access to the official Fhenix documentation below. When a developer asks about CoFHE, FHE.sol, encrypted types (euint*, ebool, eaddress), FHERC20, the cofhe-hardhat-plugin, permits, decryption flows, or any FHE smart contract pattern, answer using only the documentation in your context. Quote function signatures, package names, and code patterns exactly as shown.

If a question is ambiguous, ask one clarifying question. If something is outside the documented scope, say so explicitly rather than guessing.

Reply with:
- A direct answer in 1-3 sentences
- A working code snippet (Solidity / TypeScript) when applicable
- A note pointing to the relevant section of the docs

DOCUMENTATION:
${knowledge}`;

console.log(`System prompt: ${systemPrompt.length} chars (~${Math.round(systemPrompt.length / 4)} tokens)`);

// 2. Publish as a prompt-skill.
const c = new SkillMintClient({ privateKey: PRIVATE_KEY, network: "testnet" });
console.log(`Publisher: ${c.address}`);

const r = await c.registerSkill({
  systemPrompt,
  name: "Fhenix Expert",
  description: "Expert assistant for building on Fhenix (FHE blockchain). Answers questions about CoFHE, FHE.sol, encrypted types (euint*, ebool, eaddress), FHERC20, hardhat plugin, permits, decryption flows. Source docs run inside a TEE — never leave the enclave.",
  computeProvider: "0xa48f01287233509FD694a22Bf840225062E67836",
  model: "qwen/qwen-2.5-7b-instruct",
  price: "0.001",
});

console.log(`\n✅ Published as skill #${r.skillId}`);
console.log(`   tx     : ${r.txHash}`);
console.log(`   owner  : ${r.owner}`);
console.log(`   url    : https://skillmint-0g.vercel.app/skill/${r.skillId}`);
