import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const REGISTRY_ADDR = '0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4'; // V2
const COMPUTE_PROVIDER = '0xa48f01287233509FD694a22Bf840225062E67836';
const MODEL = 'qwen/qwen-2.5-7b-instruct';

const REGISTRY_ABI = [
  'function registerSkill(bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata) returns (uint256)',
  'function skillCount() view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);

async function main() {
  const skills = JSON.parse(fs.readFileSync(path.join(__dirname, 'skills.json'), 'utf-8'));
  console.log(`Registering ${skills.length} skills on testnet...\n`);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), '0G');

  for (const skill of skills) {
    const promptHash = ethers.keccak256(ethers.toUtf8Bytes(skill.systemPrompt));
    const priceWei = ethers.parseEther(skill.price);
    const metadata = JSON.stringify({
      name: skill.name,
      description: skill.description,
      systemPrompt: skill.systemPrompt,
      inputSchema: skill.inputSchema,
      outputSchema: skill.outputSchema,
    });

    console.log(`\nRegistering: ${skill.name}...`);
    const tx = await registry.registerSkill(promptHash, COMPUTE_PROVIDER, MODEL, priceWei, metadata);
    await tx.wait();
    const skillId = await registry.skillCount();
    console.log(`  Skill #${skillId} - TX: ${tx.hash}`);
  }

  console.log(`\nDone. Total skills on-chain: ${await registry.skillCount()}`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
