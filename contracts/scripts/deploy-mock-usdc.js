// contracts/scripts/deploy-mock-usdc.js
const { ethers, network } = require("hardhat");

async function main() {
  if (network.name !== "testnet") {
    throw new Error(`Refusing to deploy MockUSDC on ${network.name} — testnet only.`);
  }
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  console.log(`Network:  ${network.name}`);

  const Mock = await ethers.getContractFactory("MockUSDC");
  const usdc = await Mock.deploy();
  await usdc.waitForDeployment();
  const addr = await usdc.getAddress();
  console.log(`MockUSDC deployed: ${addr}`);
  console.log(`Update shared/config.js TESTNET.contracts.usdc = "${addr}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
