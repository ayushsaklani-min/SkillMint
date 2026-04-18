const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying V2 with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), '0G');

  const oracle   = deployer.address; // oracle = deployer for testnet
  const treasury = deployer.address; // treasury = deployer for testnet

  // 1. Deploy SkillRegistryV2
  console.log('\nDeploying SkillRegistryV2...');
  const Registry = await ethers.getContractFactory('SkillRegistryV2');
  const registry = await Registry.deploy(deployer.address); // admin = deployer
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log('SkillRegistryV2:', registryAddr);

  // 2. Deploy SkillEscrowV2
  console.log('\nDeploying SkillEscrowV2...');
  const Escrow = await ethers.getContractFactory('SkillEscrowV2');
  const escrow = await Escrow.deploy(registryAddr, oracle, treasury);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log('SkillEscrowV2:', escrowAddr);

  // 3. Grant ESCROW_ROLE to the escrow contract
  console.log('\nGranting ESCROW_ROLE to escrow...');
  const ESCROW_ROLE = await registry.ESCROW_ROLE();
  const tx = await registry.grantRole(ESCROW_ROLE, escrowAddr);
  await tx.wait();
  console.log('ESCROW_ROLE granted.');

  console.log('\n=== V2 DEPLOYMENT COMPLETE ===');
  console.log('SkillRegistryV2:', registryAddr);
  console.log('SkillEscrowV2:  ', escrowAddr);
  console.log('\nNext: run migrate-v1.js to migrate existing skills.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
