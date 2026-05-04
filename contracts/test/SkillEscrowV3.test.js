const { expect } = require("chai");
const { ethers } = require("hardhat");

const PROMPT = ethers.keccak256(ethers.toUtf8Bytes("p"));
const PROVIDER = "0x" + "11".repeat(20);
const MODEL = "m";
const PRICE_A0GI = ethers.parseEther("0.01");
const PRICE_USDC = 10_000n;
const META = "{}";
const INPUT_HASH = ethers.keccak256(ethers.toUtf8Bytes("input"));

async function setup() {
  const [admin, oracle, treasury, dev, agent, facilitator] = await ethers.getSigners();

  const Mock = await ethers.getContractFactory("MockUSDC");
  const usdc = await Mock.deploy();
  const w0g = await Mock.deploy();

  const Registry = await ethers.getContractFactory("SkillRegistryV3");
  const registry = await Registry.deploy(admin.address, await w0g.getAddress(), await usdc.getAddress());

  const Escrow = await ethers.getContractFactory("SkillEscrowV3");
  const escrow = await Escrow.deploy(
    await registry.getAddress(),
    oracle.address,
    treasury.address
  );
  await registry.connect(admin).grantRole(await registry.ESCROW_ROLE(), await escrow.getAddress());
  await escrow.connect(admin).grantRole(await escrow.FACILITATOR_ROLE(), facilitator.address);
  await escrow.connect(admin).addSupportedToken(await w0g.getAddress());
  await escrow.connect(admin).addSupportedToken(await usdc.getAddress());

  await registry.connect(dev).registerSkill(PROMPT, PROVIDER, MODEL, PRICE_A0GI, PRICE_USDC, META);

  await usdc.connect(admin).mint(agent.address, 1_000_000n);
  await w0g.connect(admin).mint(agent.address, ethers.parseEther("1"));

  return { admin, oracle, treasury, dev, agent, facilitator, registry, escrow, w0g, usdc };
}

describe("SkillEscrowV3", () => {
  it("native: requestExecution → confirmExecution splits 90/10 via pull-payment", async () => {
    const { oracle, treasury, dev, agent, escrow } = await setup();
    const tx = await escrow.connect(agent).requestExecution(1, INPUT_HASH, { value: PRICE_A0GI });
    const rcpt = await tx.wait();
    const ev = rcpt.logs.find(l => l.fragment?.name === "ExecutionRequested");
    const executionId = ev.args[0];
    expect(ev.args[5]).to.equal(ethers.ZeroAddress);

    const RECEIPT_HASH = ethers.keccak256(ethers.toUtf8Bytes("r"));
    await escrow.connect(oracle).confirmExecution(executionId, RECEIPT_HASH);

    const expectedTreasury = (PRICE_A0GI * 1000n) / 10000n;
    const expectedPayee = PRICE_A0GI - expectedTreasury;
    expect(await escrow.payments(dev.address)).to.equal(expectedPayee);
    expect(await escrow.payments(treasury.address)).to.equal(expectedTreasury);
  });

  it("W0G: requestExecutionWithToken → confirmExecution push-transfers to payee + treasury", async () => {
    const { oracle, treasury, dev, agent, escrow, w0g } = await setup();
    await w0g.connect(agent).approve(await escrow.getAddress(), PRICE_A0GI);
    const tx = await escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await w0g.getAddress(), PRICE_A0GI);
    const rcpt = await tx.wait();
    const ev = rcpt.logs.find(l => l.fragment?.name === "ExecutionRequested");
    const executionId = ev.args[0];
    expect(ev.args[5]).to.equal(await w0g.getAddress());

    const before = await w0g.balanceOf(dev.address);
    const RECEIPT_HASH = ethers.keccak256(ethers.toUtf8Bytes("r"));
    await escrow.connect(oracle).confirmExecution(executionId, RECEIPT_HASH);

    const expectedTreasury = (PRICE_A0GI * 1000n) / 10000n;
    const expectedPayee = PRICE_A0GI - expectedTreasury;
    expect(await w0g.balanceOf(dev.address) - before).to.equal(expectedPayee);
    expect(await w0g.balanceOf(treasury.address)).to.equal(expectedTreasury);
  });

  it("USDC: requestExecutionWithToken uses priceUSDC and push-transfers", async () => {
    const { oracle, treasury, dev, agent, escrow, usdc } = await setup();
    await usdc.connect(agent).approve(await escrow.getAddress(), PRICE_USDC);
    const tx = await escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC);
    const rcpt = await tx.wait();
    const executionId = rcpt.logs.find(l => l.fragment?.name === "ExecutionRequested").args[0];

    const RECEIPT_HASH = ethers.keccak256(ethers.toUtf8Bytes("r"));
    await escrow.connect(oracle).confirmExecution(executionId, RECEIPT_HASH);

    const expectedTreasury = (PRICE_USDC * 1000n) / 10000n;
    const expectedPayee = PRICE_USDC - expectedTreasury;
    expect(await usdc.balanceOf(dev.address)).to.equal(expectedPayee);
    expect(await usdc.balanceOf(treasury.address)).to.equal(expectedTreasury);
  });

  it("requestExecutionWithToken reverts on wrong amount", async () => {
    const { agent, escrow, usdc } = await setup();
    await usdc.connect(agent).approve(await escrow.getAddress(), PRICE_USDC);
    await expect(
      escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC + 1n)
    ).to.be.revertedWithCustomError(escrow, "WrongAmount");
  });

  it("requestExecutionWithToken reverts on unsupported token", async () => {
    const { admin, agent, escrow, usdc } = await setup();
    await escrow.connect(admin).removeSupportedToken(await usdc.getAddress());
    await usdc.connect(agent).approve(await escrow.getAddress(), PRICE_USDC);
    await expect(
      escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC)
    ).to.be.revertedWithCustomError(escrow, "UnsupportedToken");
  });

  it("priceUSDC=0 means USDC disabled — request reverts", async () => {
    const { dev, agent, escrow, usdc, registry } = await setup();
    await registry.connect(dev).updatePrice(1, PRICE_A0GI, 0n);
    await usdc.connect(agent).approve(await escrow.getAddress(), PRICE_USDC);
    await expect(
      escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC)
    ).to.be.revertedWithCustomError(registry, "USDCDisabled");
  });

  it("requestExecutionPrefunded: only FACILITATOR_ROLE; balance must cover", async () => {
    const { admin, agent, facilitator, escrow, usdc } = await setup();
    await usdc.connect(admin).mint(await escrow.getAddress(), PRICE_USDC);

    await expect(
      escrow.connect(agent).requestExecutionPrefunded(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC, agent.address)
    ).to.be.reverted;

    await escrow.connect(facilitator).requestExecutionPrefunded(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC, agent.address);
    expect(await escrow.unallocatedTokenBalance(await usdc.getAddress())).to.equal(PRICE_USDC);
  });

  it("requestExecutionPrefunded reverts Underfunded if escrow balance not actually funded", async () => {
    const { facilitator, agent, escrow, usdc } = await setup();
    await expect(
      escrow.connect(facilitator).requestExecutionPrefunded(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC, agent.address)
    ).to.be.revertedWithCustomError(escrow, "Underfunded");
  });

  it("refund (native): timeout path returns to agent via direct send", async () => {
    const { agent, escrow } = await setup();
    const tx = await escrow.connect(agent).requestExecution(1, INPUT_HASH, { value: PRICE_A0GI });
    const rcpt = await tx.wait();
    const executionId = rcpt.logs.find(l => l.fragment?.name === "ExecutionRequested").args[0];

    await ethers.provider.send("evm_increaseTime", [301]);
    await ethers.provider.send("evm_mine");

    const before = await ethers.provider.getBalance(agent.address);
    const r = await escrow.connect(agent).refund(executionId);
    const r2 = await r.wait();
    const gas = r2.gasUsed * r2.gasPrice;
    const after = await ethers.provider.getBalance(agent.address);
    expect(after - before + gas).to.equal(PRICE_A0GI);
  });

  it("refund (ERC-20): push-transfers token back to agent", async () => {
    const { agent, escrow, usdc } = await setup();
    await usdc.connect(agent).approve(await escrow.getAddress(), PRICE_USDC);
    const tx = await escrow.connect(agent).requestExecutionWithToken(1, INPUT_HASH, await usdc.getAddress(), PRICE_USDC);
    const rcpt = await tx.wait();
    const executionId = rcpt.logs.find(l => l.fragment?.name === "ExecutionRequested").args[0];

    await ethers.provider.send("evm_increaseTime", [301]);
    await ethers.provider.send("evm_mine");

    const before = await usdc.balanceOf(agent.address);
    await escrow.connect(agent).refund(executionId);
    expect(await usdc.balanceOf(agent.address) - before).to.equal(PRICE_USDC);
    expect(await escrow.unallocatedTokenBalance(await usdc.getAddress())).to.equal(0n);
  });

  it("addSupportedToken / removeSupportedToken: admin only", async () => {
    const { admin, dev, escrow } = await setup();
    const fake = "0x" + "ee".repeat(20);
    await expect(escrow.connect(dev).addSupportedToken(fake)).to.be.reverted;
    await escrow.connect(admin).addSupportedToken(fake);
    expect(await escrow.supportedTokens(fake)).to.equal(true);
    await escrow.connect(admin).removeSupportedToken(fake);
    expect(await escrow.supportedTokens(fake)).to.equal(false);
  });
});
