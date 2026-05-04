// contracts/scripts/add-supported-tokens.js
const { ethers, network } = require("hardhat");

const TOKENS = {
  testnet: [
    "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
    process.env.MOCK_USDC_ADDRESS,
  ],
  mainnet: [
    "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01",
    "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e",
  ],
};

async function main() {
  const escrowAddr = process.env.ESCROW_V3_ADDRESS;
  const facilitator = process.env.FACILITATOR_ADDRESS;
  if (!escrowAddr || !facilitator) throw new Error("Set ESCROW_V3_ADDRESS + FACILITATOR_ADDRESS env vars");

  const escrow = await ethers.getContractAt("SkillEscrowV3", escrowAddr);

  for (const t of TOKENS[network.name]) {
    if (!t) throw new Error("Missing token address (check MOCK_USDC_ADDRESS env on testnet)");
    await (await escrow.addSupportedToken(t)).wait();
    console.log(`addSupportedToken ${t}`);
  }

  const FACILITATOR_ROLE = await escrow.FACILITATOR_ROLE();
  await (await escrow.grantRole(FACILITATOR_ROLE, facilitator)).wait();
  console.log(`Granted FACILITATOR_ROLE to ${facilitator}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
