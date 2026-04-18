const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), '0G');

  const oracle   = deployer.address; // oracle = deployer for now, update after oracle backend is deployed
  const treasury = deployer.address; // treasury = deployer for now

  // 1. Deploy SkillRegistry
  console.log('\nDeploying SkillRegistry...');
  const Registry = await ethers.getContractFactory('SkillRegistry');
  const registry = await Registry.deploy(oracle);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log('SkillRegistry:', registryAddr);

  // 2. Deploy SkillEscrow
  console.log('\nDeploying SkillEscrow...');
  const Escrow = await ethers.getContractFactory('SkillEscrow');
  const escrow = await Escrow.deploy(registryAddr, oracle, treasury);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log('SkillEscrow:', escrowAddr);

  // 3. Set escrow as the oracle caller in registry (so escrow can call recordExecution)
  console.log('\nSetting escrow as oracle in SkillRegistry...');
  const tx = await registry.setOracle(escrowAddr);
  await tx.wait();
  console.log('Done.');

  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log('SkillRegistry:', registryAddr);
  console.log('SkillEscrow:  ', escrowAddr);
  console.log('\nSave these addresses!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
