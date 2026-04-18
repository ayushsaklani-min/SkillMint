const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SkillMint V2 — NFT-ified Skills', function () {
  let registry, escrow;
  let admin, developer, agent, oracle, treasury, buyer;
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes('system prompt v2'));
  const inputHash  = ethers.keccak256(ethers.toUtf8Bytes('user input'));
  const receiptHash = ethers.keccak256(ethers.toUtf8Bytes('receipt json'));
  const price = ethers.parseEther('0.01');

  beforeEach(async function () {
    [admin, developer, agent, oracle, treasury, buyer] = await ethers.getSigners();

    // Deploy SkillRegistryV2
    const Registry = await ethers.getContractFactory('SkillRegistryV2');
    registry = await Registry.connect(admin).deploy(admin.address);
    await registry.waitForDeployment();

    // Deploy SkillEscrowV2
    const Escrow = await ethers.getContractFactory('SkillEscrowV2');
    escrow = await Escrow.connect(admin).deploy(
      await registry.getAddress(),
      oracle.address,
      treasury.address
    );
    await escrow.waitForDeployment();

    // Grant ESCROW_ROLE to the escrow contract
    const ESCROW_ROLE = await registry.ESCROW_ROLE();
    await registry.connect(admin).grantRole(ESCROW_ROLE, await escrow.getAddress());
  });

  // ─── SkillRegistryV2 Tests ──────────────────────────────────────────────

  describe('SkillRegistryV2', function () {
    it('registers a skill and mints NFT to developer', async function () {
      const tx = await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'qwen/qwen-2.5-7b-instruct', price, '{"name":"test"}'
      );
      await tx.wait();

      // Skill exists
      expect(await registry.skillCount()).to.equal(1);

      // NFT minted to developer
      expect(await registry.ownerOf(1)).to.equal(developer.address);
      expect(await registry.balanceOf(developer.address)).to.equal(1);

      // Skill data correct
      const skill = await registry.getSkill(1);
      expect(skill.developer).to.equal(developer.address);
      expect(skill.promptHash).to.equal(promptHash);
      expect(skill.priceA0GI).to.equal(price);
      expect(skill.active).to.equal(true);
      expect(skill.exists).to.equal(true);
    });

    it('emits SkillMinted event', async function () {
      await expect(
        registry.connect(developer).registerSkill(
          promptHash, agent.address, 'model', price, '{}'
        )
      ).to.emit(registry, 'SkillMinted')
       .withArgs(1, developer.address, promptHash, 'model', price);
    });

    it('returns correct ERC-721 name and symbol', async function () {
      expect(await registry.name()).to.equal('0G Skill');
      expect(await registry.symbol()).to.equal('SKILL');
    });

    it('NFT is transferable', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );

      // Transfer NFT from developer to buyer
      await registry.connect(developer).transferFrom(developer.address, buyer.address, 1);

      expect(await registry.ownerOf(1)).to.equal(buyer.address);
      expect(await registry.balanceOf(developer.address)).to.equal(0);
      expect(await registry.balanceOf(buyer.address)).to.equal(1);
    });

    it('emits SkillTransferred on transfer', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );

      await expect(
        registry.connect(developer).transferFrom(developer.address, buyer.address, 1)
      ).to.emit(registry, 'SkillTransferred')
       .withArgs(1, developer.address, buyer.address);
    });

    it('only NFT owner can update price', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );

      const newPrice = ethers.parseEther('0.02');
      await registry.connect(developer).updatePrice(1, newPrice);
      const skill = await registry.getSkill(1);
      expect(skill.priceA0GI).to.equal(newPrice);

      // Non-owner cannot update
      await expect(
        registry.connect(agent).updatePrice(1, price)
      ).to.be.revertedWith('not owner');
    });

    it('only NFT owner can deactivate/activate', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );

      await registry.connect(developer).deactivateSkill(1);
      expect((await registry.getSkill(1)).active).to.equal(false);

      await registry.connect(developer).activateSkill(1);
      expect((await registry.getSkill(1)).active).to.equal(true);

      // Non-owner cannot deactivate
      await expect(
        registry.connect(agent).deactivateSkill(1)
      ).to.be.revertedWith('not owner');
    });

    it('returns on-chain tokenURI as base64 JSON', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'qwen/qwen-2.5-7b-instruct', price, '{"name":"Auditor"}'
      );

      const uri = await registry.tokenURI(1);
      expect(uri).to.match(/^data:application\/json;base64,/);

      // Decode and verify JSON
      const base64 = uri.replace('data:application/json;base64,', '');
      const json = JSON.parse(Buffer.from(base64, 'base64').toString());
      expect(json.name).to.equal('0G Skill #1');
      expect(json.attributes).to.be.an('array');
    });

    it('supports ERC-2981 royalties (5%)', async function () {
      await registry.connect(developer).registerSkill(
        promptHash, agent.address, 'model', price, '{}'
      );

      const salePrice = ethers.parseEther('1');
      const [receiver, royalty] = await registry.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(developer.address);
      expect(royalty).to.equal(ethers.parseEther('0.05')); // 5%
    });

    it('tracks developer skills', async function () {
      await registry.connect(developer).registerSkill(promptHash, agent.address, 'model1', price, '{}');
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

  // ─── Migration Tests ────────────────────────────────────────────────────

  describe('Migration', function () {
    it('migrates V1 skills', async function () {
      const skills = [
        {
          developer: developer.address,
          promptHash,
          computeProvider: agent.address,
          model: 'qwen/qwen-2.5-7b-instruct',
          priceA0GI: price,
          metadata: '{"name":"Migrated Skill"}',
          executionCount: 5,
          successfulExecutions: 4,
          totalRevenueEarned: ethers.parseEther('0.004'),
          createdAt: Math.floor(Date.now() / 1000),
          active: true,
          exists: true,
        }
      ];

      await registry.connect(admin).migrate([1], skills);

      expect(await registry.ownerOf(1)).to.equal(developer.address);
      const s = await registry.getSkill(1);
      expect(s.executionCount).to.equal(5);
      expect(s.successfulExecutions).to.equal(4);
    });

    it('prevents migration after finalization', async function () {
      await registry.connect(admin).finalizeMigration();

      const skills = [{
        developer: developer.address, promptHash, computeProvider: agent.address,
        model: 'model', priceA0GI: price, metadata: '{}', executionCount: 0,
        successfulExecutions: 0, totalRevenueEarned: 0,
        createdAt: Math.floor(Date.now() / 1000), active: true, exists: true,
      }];

      await expect(
        registry.connect(admin).migrate([1], skills)
      ).to.be.revertedWith('migration finalized');
    });

    it('prevents double migration of same skillId', async function () {
      const skills = [{
        developer: developer.address, promptHash, computeProvider: agent.address,
        model: 'model', priceA0GI: price, metadata: '{}', executionCount: 0,
        successfulExecutions: 0, totalRevenueEarned: 0,
        createdAt: Math.floor(Date.now() / 1000), active: true, exists: true,
      }];

      await registry.connect(admin).migrate([1], skills);
      await expect(
        registry.connect(admin).migrate([1], skills)
      ).to.be.revertedWith('already migrated');
    });
  });

  // ─── SkillEscrowV2 Tests ────────────────────────────────────────────────

  describe('SkillEscrowV2', function () {
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

    it('snapshots NFT owner at funding time', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      const exec = await escrow.getExecution(executionId);
      expect(exec.payeeAtFunding).to.equal(developer.address);
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

    it('full cycle: request → confirm → withdraw (revenue follows NFT owner)', async function () {
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

      // Developer withdraws revenue via PullPayment
      const balBefore = await ethers.provider.getBalance(developer.address);
      await escrow.connect(developer).withdrawPayments(developer.address);
      const balAfter = await ethers.provider.getBalance(developer.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it('revenue goes to NEW owner after NFT transfer', async function () {
      // Transfer NFT to buyer
      await registry.connect(developer).transferFrom(developer.address, buyer.address, skillId);
      expect(await registry.ownerOf(skillId)).to.equal(buyer.address);

      // Agent requests execution — payee should now be buyer
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      // Verify snapshot
      const exec = await escrow.getExecution(executionId);
      expect(exec.payeeAtFunding).to.equal(buyer.address);

      // Oracle confirms
      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);

      // Buyer (new owner) can withdraw, developer cannot
      const buyerPending = await escrow.payments(buyer.address);
      const devPending = await escrow.payments(developer.address);
      expect(buyerPending).to.be.gt(0);
      expect(devPending).to.equal(0);

      // Buyer withdraws
      const balBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(buyer).withdrawPayments(buyer.address);
      const balAfter = await ethers.provider.getBalance(buyer.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it('in-flight execution pays original owner (snapshot protection)', async function () {
      // Agent requests execution while developer owns NFT
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      // NFT transfers to buyer AFTER funding (simulates front-run attempt)
      await registry.connect(developer).transferFrom(developer.address, buyer.address, skillId);

      // Oracle confirms — should pay developer (snapshot), NOT buyer
      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);

      const devPending = await escrow.payments(developer.address);
      const buyerPending = await escrow.payments(buyer.address);
      expect(devPending).to.be.gt(0);
      expect(buyerPending).to.equal(0);
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

    it('treasury receives 10% cut', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);

      const treasuryPending = await escrow.payments(treasury.address);
      const expectedTreasury = (price * 1000n) / 10000n; // 10%
      expect(treasuryPending).to.equal(expectedTreasury);
    });

    it('records revenue on the NFT', async function () {
      const tx = await escrow.connect(agent).requestExecution(skillId, inputHash, { value: price });
      const receipt = await tx.wait();
      const parsed = receipt.logs.map(l => {
        try { return escrow.interface.parseLog(l); } catch { return null; }
      }).find(p => p?.name === 'ExecutionRequested');
      const executionId = parsed.args.executionId;

      await escrow.connect(oracle).confirmExecution(executionId, receiptHash);

      const skill = await registry.getSkill(skillId);
      expect(skill.executionCount).to.equal(1);
      expect(skill.totalRevenueEarned).to.be.gt(0);
    });
  });
});
