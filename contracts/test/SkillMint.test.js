const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SkillMint Full Cycle', function () {
  let registry, escrow;
  let owner, developer, agent, oracle, treasury;
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes('system prompt v1'));
  const inputHash  = ethers.keccak256(ethers.toUtf8Bytes('user input'));
  const receiptHash = ethers.keccak256(ethers.toUtf8Bytes('receipt json'));
  const price = ethers.parseEther('0.01');

  beforeEach(async function () {
    [owner, developer, agent, oracle, treasury] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory('SkillRegistry');
    registry = await Registry.deploy(oracle.address);
    await registry.waitForDeployment();

    const Escrow = await ethers.getContractFactory('SkillEscrow');
    escrow = await Escrow.deploy(await registry.getAddress(), oracle.address, treasury.address);
    await escrow.waitForDeployment();

    // Set escrow as oracle in registry so recordExecution works
    await registry.setOracle(await escrow.getAddress());
  });

  describe('SkillRegistry', function () {
    it('registers a skill and returns skillId', async function () {
      const tx = await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'qwen/qwen-2.5-7b-instruct', price, '{"name":"test"}'
      );
      const receipt = await tx.wait();
      expect(await registry.skillCount()).to.equal(1);

      const [id, dev, hash, provider, model, p, meta, active, total, success, created] =
        await registry.getSkill(1);
      expect(id).to.equal(1);
      expect(dev).to.equal(developer.address);
      expect(hash).to.equal(promptHash);
      expect(active).to.equal(true);
      expect(p).to.equal(price);
    });

    it('updates price only by skill owner', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );
      const newPrice = ethers.parseEther('0.02');
      await registry.connect(developer).updateSkillPrice(1, newPrice);
      const [,,,,, p] = await registry.getSkill(1);
      expect(p).to.equal(newPrice);

      await expect(
        registry.connect(agent).updateSkillPrice(1, price)
      ).to.be.revertedWith('Not skill owner');
    });

    it('deactivates skill', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );
      await registry.connect(developer).deactivateSkill(1);
      const [,,,,,,,active] = await registry.getSkill(1);
      expect(active).to.equal(false);
    });

    it('tracks developer skills', async function () {
      await registry.connect(developer).registerSkill(promptHash, agent.address, 'model', price, '{}');
      await registry.connect(developer).registerSkill(promptHash, agent.address, 'model2', price, '{}');
      const skills = await registry.getDeveloperSkills(developer.address);
      expect(skills.length).to.equal(2);
    });

    it('returns reputation score', async function () {
      await registry.connect(developer).registerSkill(promptHash, agent.address, 'model', price, '{}');
      const [total, successful, rate] = await registry.getReputationScore(1);
      expect(total).to.equal(0);
      expect(rate).to.equal(0);
    });
  });

  describe('SkillEscrow', function () {
    let skillId;

    beforeEach(async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'qwen/qwen-2.5-7b-instruct', price, '{"name":"test"}'
      );
      skillId = 1;
    });

    it('accepts execution request with correct payment', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => {
        try { return escrow.interface.parseLog(l)?.name === 'ExecutionRequested'; } catch { return false; }
      });
      expect(event).to.not.be.undefined;
    });

    it('rejects underpayment', async function () {
      await expect(
        escrow.connect(agent).requestExecution(skillId, inputHash, { value: 0 })
      ).to.be.revertedWith('Insufficient payment');
    });

    it('rejects execution for inactive skill', async function () {
      await registry.connect(developer).deactivateSkill(skillId);
      await expect(
        escrow.connect(agent).requestExecution(skillId, inputHash, { value: price })
      ).to.be.revertedWith('Skill is not active');
    });

    it('full cycle: request → confirm → claim', async function () {
      // Agent requests execution
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      // Oracle confirms
      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);

      // Check reputation updated
      const [total, successful, rate] = await registry.getReputationScore(skillId);
      expect(total).to.equal(1);
      expect(successful).to.equal(1);
      expect(rate).to.equal(100);

      // Developer claims revenue
      const balBefore = await ethers.provider.getBalance(developer.address);
      await escrow.connect(developer).claimRevenue();
      const balAfter = await ethers.provider.getBalance(developer.address);
      expect(balAfter).to.be.gt(balBefore);

      // Check developer balance cleared
      expect(await escrow.developerBalances(developer.address)).to.equal(0);
    });

    it('refund after timeout', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      // Fast-forward 6 minutes
      await ethers.provider.send('evm_increaseTime', [360]);
      await ethers.provider.send('evm_mine');

      // Anyone can refund after timeout
      await escrow.connect(agent).refund(executionId);

      const exec = await escrow.getExecution(executionId);
      expect(exec.refunded).to.equal(true);
    });

    it('prevents double settlement', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);
      await expect(
        escrow.connect(oracle).confirmExecution(executionId, receiptHash)
      ).to.be.revertedWith('Already settled');
    });
  });
});
