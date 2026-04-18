const { ethers } = require('hardhat');

// V1 contract address (testnet)
const V1_REGISTRY = '0xC4b41DA4FF0fcE60a6202864308983C23F3ea767';
// V2 contract address — UPDATE AFTER DEPLOY
const V2_REGISTRY = process.env.V2_REGISTRY || '';

const V1_ABI = [
  'function skillCount() view returns (uint256)',
  'function getSkill(uint256 skillId) view returns (uint256 id, address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata, bool active, uint256 totalExecutions, uint256 successfulExecutions, uint256 createdAt)',
];

async function main() {
  if (!V2_REGISTRY) {
    console.error('Set V2_REGISTRY env var to the deployed SkillRegistryV2 address.');
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log('Migrating with:', deployer.address);

  const v1 = new ethers.Contract(V1_REGISTRY, V1_ABI, deployer);
  const v2 = await ethers.getContractAt('SkillRegistryV2', V2_REGISTRY, deployer);

  const count = Number(await v1.skillCount());
  console.log(`V1 has ${count} skills to migrate.\n`);

  if (count === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  const ids = [];
  const skills = [];

  for (let i = 1; i <= count; i++) {
    const [id, developer, promptHash, computeProvider, model, priceA0GI, metadata, active, totalExecutions, successfulExecutions, createdAt] =
      await v1.getSkill(i);

    console.log(`  Reading V1 skill #${i}: developer=${developer}`);

    ids.push(i);
    skills.push({
      developer,
      promptHash,
      computeProvider,
      model,
      priceA0GI,
      metadata,
      executionCount: totalExecutions,
      successfulExecutions,
      totalRevenueEarned: 0, // V1 didn't track revenue
      createdAt: Number(createdAt),
      active,
      exists: true,
    });
  }

  // Migrate in one batch (small enough for testnet)
  console.log(`\nMigrating ${ids.length} skills to V2...`);
  const tx = await v2.migrate(ids, skills);
  await tx.wait();
  console.log(`Migration TX: ${tx.hash}`);

  // Verify
  for (const id of ids) {
    const owner = await v2.ownerOf(id);
    const skill = await v2.getSkill(id);
    console.log(`  Skill #${id}: owner=${owner}, dev=${skill.developer}, active=${skill.active}`);
  }

  // Finalize migration
  console.log('\nFinalizing migration...');
  const finTx = await v2.finalizeMigration();
  await finTx.wait();
  console.log('Migration finalized. No more migrations possible.');

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`Migrated ${ids.length} skills from V1 → V2`);
  console.log(`V2 skillCount: ${await v2.skillCount()}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
