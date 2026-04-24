const { ethers } = require('hardhat');

// Deploy W0G test wrapper + built-in wrap/unwrap smoke test.
// Usage:  npx hardhat run scripts/deploy-w0g.js --network testnet
async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`\nDeploying W0G on chainId ${net.chainId}`);
  console.log('Deployer:', deployer.address);
  console.log('Balance :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'native');

  const W0G = await ethers.getContractFactory('W0G');
  const w0g = await W0G.deploy();
  await w0g.waitForDeployment();
  const addr = await w0g.getAddress();
  console.log('W0G deployed:', addr);

  // ─── Smoke test: wrap → unwrap ───────────────────────────────────────────
  const amount = ethers.parseEther('0.01');
  console.log(`\nSmoke test — wrap ${ethers.formatEther(amount)} native …`);
  const txDep = await w0g.deposit({ value: amount });
  await txDep.wait();
  const wrapped = await w0g.balanceOf(deployer.address);
  console.log('  W0G balance after deposit:', ethers.formatEther(wrapped));
  if (wrapped !== amount) throw new Error(`expected ${amount}, got ${wrapped}`);

  console.log('Smoke test — unwrap …');
  const txWd = await w0g.withdraw(amount);
  await txWd.wait();
  const after = await w0g.balanceOf(deployer.address);
  console.log('  W0G balance after withdraw:', ethers.formatEther(after));
  if (after !== 0n) throw new Error(`expected 0, got ${after}`);

  console.log('\n=== W0G DEPLOYMENT COMPLETE ===');
  console.log('Address:', addr);
  console.log('Deposit tx:', txDep.hash);
  console.log('Withdraw tx:', txWd.hash);
  console.log('\nNext: add this address to shared/config.js under testnet.w0g');
}

main().catch(err => { console.error(err); process.exit(1); });
