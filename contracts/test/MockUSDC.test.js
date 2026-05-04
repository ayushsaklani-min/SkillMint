const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", () => {
  it("has 6 decimals and lets anyone mint", async () => {
    const [a, b] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockUSDC");
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();

    expect(await usdc.decimals()).to.equal(6);
    expect(await usdc.symbol()).to.equal("USDC");

    expect(await usdc.balanceOf(a.address)).to.equal(1_000_000n * 10n ** 6n);

    await usdc.connect(b).mint(b.address, 100_000_000n);
    expect(await usdc.balanceOf(b.address)).to.equal(100_000_000n);
  });
});
