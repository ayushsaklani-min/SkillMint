const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SkillRegistryV3", () => {
  let registry, w0g, usdc, dev, admin, other;
  const PROMPT_HASH = ethers.keccak256(ethers.toUtf8Bytes("hi"));
  const PROVIDER = "0x" + "11".repeat(20);
  const MODEL = "test-model";
  const PRICE_A0GI = ethers.parseEther("0.001");
  const PRICE_USDC = 5000n;
  const META = "{}";

  beforeEach(async () => {
    [admin, dev, other] = await ethers.getSigners();
    w0g  = "0x" + "aa".repeat(20);
    usdc = "0x" + "bb".repeat(20);
    const Registry = await ethers.getContractFactory("SkillRegistryV3");
    registry = await Registry.deploy(admin.address, w0g, usdc);
    await registry.waitForDeployment();
  });

  it("stores both prices on registerSkill", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);
    const s = await registry.getSkill(1);
    expect(s.priceA0GI).to.equal(PRICE_A0GI);
    expect(s.priceUSDC).to.equal(PRICE_USDC);
  });

  it("priceFor() returns priceA0GI for native (address(0)) and W0G", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);
    expect(await registry.priceFor(1, ethers.ZeroAddress)).to.equal(PRICE_A0GI);
    expect(await registry.priceFor(1, w0g)).to.equal(PRICE_A0GI);
  });

  it("priceFor() returns priceUSDC for USDC token address", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);
    expect(await registry.priceFor(1, usdc)).to.equal(PRICE_USDC);
  });

  it("priceFor() reverts USDCDisabled when priceUSDC is 0 for that skill", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, 0n, META);
    await expect(registry.priceFor(1, usdc)).to.be.revertedWithCustomError(registry, "USDCDisabled");
  });

  it("priceFor() reverts UnsupportedToken for unknown token", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);
    await expect(registry.priceFor(1, "0x" + "cc".repeat(20)))
      .to.be.revertedWithCustomError(registry, "UnsupportedToken");
  });

  it("updatePrice(skillId, a0gi, usdc) updates both atomically — owner only", async () => {
    await registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);
    await expect(registry.connect(other).updatePrice(1, ethers.parseEther("0.01"), 10000n))
      .to.be.revertedWith("not owner");
    await registry.connect(dev).updatePrice(1, ethers.parseEther("0.01"), 10000n);
    const s = await registry.getSkill(1);
    expect(s.priceA0GI).to.equal(ethers.parseEther("0.01"));
    expect(s.priceUSDC).to.equal(10000n);
  });

  it("registerSkill rejects priceA0GI == 0 (priceUSDC == 0 is allowed = USDC disabled)", async () => {
    await expect(registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, 0n, PRICE_USDC, META))
      .to.be.revertedWith("Price must be > 0");
    await expect(registry.connect(dev).registerSkill(PROMPT_HASH, PROVIDER, MODEL, PRICE_A0GI, 0n, META))
      .to.not.be.reverted;
  });

  it("migrate rejects zero developer or zero priceA0GI", async () => {
    const fresh = await (await ethers.getContractFactory("SkillRegistryV3"))
      .deploy(admin.address, w0g, usdc);
    await fresh.waitForDeployment();

    const goodSkill = {
      developer: dev.address,
      promptHash: PROMPT_HASH,
      computeProvider: PROVIDER,
      model: MODEL,
      priceA0GI: PRICE_A0GI,
      priceUSDC: PRICE_USDC,
      metadata: META,
      executionCount: 0,
      successfulExecutions: 0,
      totalRevenueEarned: 0,
      createdAt: 0,
      active: true,
      exists: true,
    };
    const zeroDev = { ...goodSkill, developer: ethers.ZeroAddress };
    const zeroPrice = { ...goodSkill, priceA0GI: 0n };

    await expect(fresh.connect(admin).migrate([1], [zeroDev]))
      .to.be.revertedWith("migrate: zero developer");
    await expect(fresh.connect(admin).migrate([1], [zeroPrice]))
      .to.be.revertedWith("migrate: zero priceA0GI");
    // Sanity: a good skill still migrates
    await expect(fresh.connect(admin).migrate([1], [goodSkill])).to.not.be.reverted;
  });
});
