// contracts/scripts/republish-skills.js
// Re-publish the V2 skills on V3 from the original publisher wallets.

const { ethers, network } = require("hardhat");

const V2_REGISTRY = "0x14cE1f53089c414bFf75e1c462E45ecc19Bf8F09";
const V2_REGISTRY_ABI = [
  "function getSkill(uint256) view returns (tuple(address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata, uint256 executionCount, uint256 successfulExecutions, uint256 totalRevenueEarned, uint64 createdAt, bool active, bool exists))",
  "function ownerOf(uint256) view returns (address)",
  "function skillCount() view returns (uint256)",
];

async function main() {
  if (network.name !== "mainnet") {
    console.log(`Note: running on ${network.name}. Use mainnet for production republish.`);
  }
  const v3Addr = process.env.REGISTRY_V3_ADDRESS;
  if (!v3Addr) throw new Error("Set REGISTRY_V3_ADDRESS env");

  const provider = ethers.provider;
  const v2 = new ethers.Contract(V2_REGISTRY, V2_REGISTRY_ABI, provider);
  const skillCount = Number(await v2.skillCount());
  console.log(`V2 has ${skillCount} skills.`);

  const KEYS = [process.env.REPUBLISH_KEY_1, process.env.REPUBLISH_KEY_2, process.env.REPUBLISH_KEY_3].filter(Boolean);
  const wallets = KEYS.map((k) => new ethers.Wallet(k, provider));

  for (let id = 1; id <= skillCount; id++) {
    const skill = await v2.getSkill(id);
    const owner = await v2.ownerOf(id);
    const w = wallets.find((x) => x.address.toLowerCase() === owner.toLowerCase());
    if (!w) {
      console.log(`SKIP skill #${id} — no key for owner ${owner}`);
      continue;
    }
    const v3 = await ethers.getContractAt("SkillRegistryV3", v3Addr, w);

    // priceUSDC: rough placeholder — publisher MUST update via updatePrice() after republish.
    const priceUsdcDefault = (BigInt(skill.priceA0GI) * 50n) / (10n ** 18n) * 10n;
    console.log(`Republishing skill #${id} owner=${owner} priceA0GI=${skill.priceA0GI} priceUSDC=${priceUsdcDefault}`);
    const tx = await v3.registerSkill(
      skill.promptHash, skill.computeProvider, skill.model,
      skill.priceA0GI, priceUsdcDefault, skill.metadata
    );
    await tx.wait();
    console.log(`  re-minted in ${tx.hash}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
