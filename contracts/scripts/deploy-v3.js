// contracts/scripts/deploy-v3.js
const { ethers, network } = require("hardhat");

const ADDRS = {
  testnet: {
    w0g:  "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
    usdc: process.env.MOCK_USDC_ADDRESS,
  },
  mainnet: {
    w0g:  "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01",
    usdc: "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e",
  },
};

async function main() {
  const cfg = ADDRS[network.name];
  if (!cfg) throw new Error(`Unsupported network ${network.name}`);
  if (!cfg.usdc) throw new Error(`Missing MOCK_USDC_ADDRESS env for testnet`);

  const [signer] = await ethers.getSigners();
  const oracleAddr = process.env.ORACLE_ADDRESS;
  const treasuryAddr = process.env.TREASURY_ADDRESS;
  if (!oracleAddr || !treasuryAddr) throw new Error("Set ORACLE_ADDRESS + TREASURY_ADDRESS env vars");

  console.log(`Deployer: ${signer.address}`);
  console.log(`Network:  ${network.name}`);
  console.log(`W0G:      ${cfg.w0g}`);
  console.log(`USDC:     ${cfg.usdc}`);
  console.log(`Oracle:   ${oracleAddr}`);
  console.log(`Treasury: ${treasuryAddr}`);

  const Registry = await ethers.getContractFactory("SkillRegistryV3");
  const registry = await Registry.deploy(signer.address, cfg.w0g, cfg.usdc);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`SkillRegistryV3: ${registryAddr}`);

  const Escrow = await ethers.getContractFactory("SkillEscrowV3");
  const escrow = await Escrow.deploy(registryAddr, oracleAddr, treasuryAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`SkillEscrowV3:   ${escrowAddr}`);

  const ESCROW_ROLE = await registry.ESCROW_ROLE();
  await (await registry.grantRole(ESCROW_ROLE, escrowAddr)).wait();
  console.log("Granted ESCROW_ROLE on registry to escrow");

  console.log("\nNext steps:");
  console.log(`  ESCROW_V3_ADDRESS=${escrowAddr} FACILITATOR_ADDRESS=<addr> npx hardhat run scripts/add-supported-tokens.js --network ${network.name}`);
  console.log(`  Update shared/config.js with these addresses:`);
  console.log(`    registry: "${registryAddr}"`);
  console.log(`    escrow:   "${escrowAddr}"`);
  console.log(`    usdc:     "${cfg.usdc}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
