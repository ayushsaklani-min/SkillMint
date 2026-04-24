const { expect } = require('chai');
const { ethers } = require('hardhat');

// EIP-3009 typed-data helper — matches the constants in W0G.sol
async function signTransferAuth(signer, w0g, { from, to, value, validAfter, validBefore, nonce }) {
  const domain = {
    name: 'Wrapped 0G',
    version: '1',
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await w0g.getAddress(),
  };
  const types = {
    TransferWithAuthorization: [
      { name: 'from',        type: 'address' },
      { name: 'to',          type: 'address' },
      { name: 'value',       type: 'uint256' },
      { name: 'validAfter',  type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce',       type: 'bytes32' },
    ],
  };
  const msg = { from, to, value, validAfter, validBefore, nonce };
  const sig = await signer.signTypedData(domain, types, msg);
  return ethers.Signature.from(sig);
}

describe('W0G — Wrapped 0G (testnet wrapper)', function () {
  let w0g;
  let alice, bob, facilitator;

  beforeEach(async function () {
    [alice, bob, facilitator] = await ethers.getSigners();
    const W0G = await ethers.getContractFactory('W0G');
    w0g = await W0G.deploy();
    await w0g.waitForDeployment();
  });

  it('deposit mints W0G 1:1 to sender and updates total supply', async function () {
    const value = ethers.parseEther('0.5');
    await expect(w0g.connect(alice).deposit({ value }))
      .to.emit(w0g, 'Deposit').withArgs(alice.address, value);
    expect(await w0g.balanceOf(alice.address)).to.equal(value);
    expect(await w0g.totalSupply()).to.equal(value);

    // receive() fallback: plain transfer also wraps
    await alice.sendTransaction({ to: await w0g.getAddress(), value });
    expect(await w0g.balanceOf(alice.address)).to.equal(value * 2n);
  });

  it('withdraw burns W0G and returns native token', async function () {
    const value = ethers.parseEther('0.3');
    await w0g.connect(alice).deposit({ value });

    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx = await w0g.connect(alice).withdraw(value);
    const rcpt = await tx.wait();
    const gasCost = rcpt.gasUsed * rcpt.gasPrice;
    const balAfter = await ethers.provider.getBalance(alice.address);

    expect(await w0g.balanceOf(alice.address)).to.equal(0);
    expect(await w0g.totalSupply()).to.equal(0);
    expect(balAfter - balBefore + gasCost).to.equal(value);
  });

  it('standard ERC20 transfer moves balance', async function () {
    const value = ethers.parseEther('0.2');
    await w0g.connect(alice).deposit({ value });
    await w0g.connect(alice).transfer(bob.address, value);
    expect(await w0g.balanceOf(alice.address)).to.equal(0);
    expect(await w0g.balanceOf(bob.address)).to.equal(value);
  });

  describe('EIP-3009 transferWithAuthorization', function () {
    const value = ethers.parseEther('0.01');

    async function makeAuth(overrides = {}) {
      const latest = await ethers.provider.getBlock('latest');
      const base = {
        from: alice.address,
        to: bob.address,
        value,
        validAfter: 0,
        validBefore: latest.timestamp + 3600,
        nonce: ethers.hexlify(ethers.randomBytes(32)),
      };
      return { ...base, ...overrides };
    }

    beforeEach(async function () {
      await w0g.connect(alice).deposit({ value: ethers.parseEther('1') });
    });

    it('settles a valid authorization submitted by a third-party facilitator', async function () {
      const auth = await makeAuth();
      const sig = await signTransferAuth(alice, w0g, auth);

      await expect(
        w0g.connect(facilitator).transferWithAuthorization(
          auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce,
          sig.v, sig.r, sig.s
        )
      ).to.emit(w0g, 'AuthorizationUsed').withArgs(auth.from, auth.nonce);

      expect(await w0g.balanceOf(bob.address)).to.equal(value);
      expect(await w0g.authorizationState(auth.from, auth.nonce)).to.equal(true);
    });

    it('reverts when the authorization is expired (validBefore < now)', async function () {
      const latest = await ethers.provider.getBlock('latest');
      const auth = await makeAuth({ validBefore: latest.timestamp - 1 });
      const sig = await signTransferAuth(alice, w0g, auth);

      await expect(
        w0g.connect(facilitator).transferWithAuthorization(
          auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce,
          sig.v, sig.r, sig.s
        )
      ).to.be.revertedWith('W0G: auth expired');
    });

    it('reverts on replay (same nonce used twice)', async function () {
      const auth = await makeAuth();
      const sig = await signTransferAuth(alice, w0g, auth);

      await w0g.connect(facilitator).transferWithAuthorization(
        auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce,
        sig.v, sig.r, sig.s
      );

      await expect(
        w0g.connect(facilitator).transferWithAuthorization(
          auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce,
          sig.v, sig.r, sig.s
        )
      ).to.be.revertedWith('W0G: auth used');
    });

    it('reverts if someone else signs for alice (wrong signer)', async function () {
      const auth = await makeAuth();
      const sig = await signTransferAuth(bob, w0g, auth); // bob signs, but auth says from=alice

      await expect(
        w0g.connect(facilitator).transferWithAuthorization(
          auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce,
          sig.v, sig.r, sig.s
        )
      ).to.be.revertedWith('W0G: invalid signature');
    });
  });
});
