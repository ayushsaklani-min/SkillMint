# SMP-1: Verified Skill Standard for 0G Agent Ecosystem

**Title:** Verified Skill Standard (VSS) for 0G Agents
**Proposal ID:** SMP-1 (SkillMint Improvement Proposal · v1)
**Author:** SkillMint Protocol
**Status:** Draft — community feedback open
**Type:** Standards Track
**Category:** Agent Infrastructure
**Created:** May 2026
**Requires:** 0G Agent ID, 0G Compute (TEE), 0G Storage

> SMP-1 is published by the SkillMint team as a proposal for the 0G ecosystem. It is **not** an official 0G core protocol document. We use "SMP-" rather than "0GIP-" or similar to make clear this is a *community-authored* standard inviting adoption, not a claim on 0G's namespace.

---

## Abstract

This proposal defines a standard interface for publishing, discovering, executing, and verifying AI skills on the 0G network. A "skill" is a discrete, monetizable AI capability — a system prompt, a reasoning module, or a code bundle — that any agent or human can call on-chain with a cryptographic guarantee of what ran, which model ran it, and what it returned.

Without this standard, every agent on 0G implements skill execution differently. There is no shared verification layer. A compromised skill looks identical to a legitimate one. SMP-1 fixes this at the protocol level.

---

## Motivation

### The ClawHavoc Scenario

Consider the following near-future scenario, which we call **ClawHavoc**:

> 539 malicious skills are uploaded to a popular agent-framework marketplace. Nearly **19% of popular agent skills become compromised**. Attackers poison the ecosystem with skills that:
> - Harvest agent credentials silently
> - Exfiltrate memory files (SOUL.md, MEMORY.md)
> - Open reverse shells inside agent runtimes
> - Modify agent behavior while appearing completely normal
>
> No attestation exists. No execution receipt. No way to distinguish a legitimate run from a compromised one.

ClawHavoc is not an edge case. It is the **inevitable** result of building an agent economy without a verification standard — the open-source supply-chain attack pattern (npm `event-stream`, PyPI typosquats, VSCode extension malware) applied to AI agents, where the blast radius is "your wallet" instead of "your dev box."

As 0G scales to millions of autonomous agents transacting in real time, the attack surface grows proportionally. SMP-1 establishes the trust layer **before** the first ClawHavoc happens.

### Why This Must Be a Protocol Standard, Not a Product

A single product can be forked, copied, or ignored. A protocol standard becomes the baseline expectation for the entire ecosystem. SMP-1 proposes that:

- Any valid 0G skill should conform to this interface
- Any 0G agent consuming skills should be able to verify compliance
- 0G Agent ID may optionally reference SMP-1 verified skills

This is how HTTPS became non-negotiable for the web — not by force, but by making unverified execution visibly risky. SMP-1 aims for the same outcome in the agent ecosystem.

---

## Specification

### 1. Skill Types

SMP-1 defines two canonical skill kinds:

| Kind | Description | Verification |
|---|---|---|
| `AI_SKILL` | A system prompt executed inside a TEE on 0G Compute | TEE attestation: model + prompt hash + output hash, hardware-signed |
| `AGENT_SKILL` | A folder bundle (SKILL.md + references), Claude Code / Codex / Cursor compatible | SHA-256 of bundle anchored on-chain, verified on download |

Both kinds are published as ERC-721 NFTs. Ownership of the NFT controls revenue rights. Transfer of the NFT transfers revenue.

---

### 2. On-Chain Interface

Every SMP-1 compliant skill registry must implement the following minimum interface. Note `executionId` is `bytes32` — it is derived from `keccak256(skillId, caller, inputHash, blockTimestamp, nonce)` and is **not** a monotonically increasing counter. This collision-resistant derivation is what makes off-chain verification trustless.

```solidity
interface ISMP1SkillRegistry {

    // --- Events ---

    event SkillRegistered(
        uint256 indexed skillId,
        address indexed creator,
        SkillKind kind,
        bytes32 storageRoot,    // 0G Storage root of encrypted prompt or bundle
        uint256 priceNative,    // price in native 0G (wei)
        uint256 priceUSDC       // price in USDC.E (6 decimals); 0 = disabled
    );

    event ExecutionRequested(
        bytes32 indexed executionId,
        uint256 indexed skillId,
        address indexed caller,
        bytes32 inputHash,
        uint256 amount,
        address paymentToken
    );

    event ExecutionConfirmed(
        bytes32 indexed executionId,
        bytes32 receiptRoot,    // 0G Storage root of TEE-signed receipt
        address payee,
        uint256 payeeAmount,
        uint256 treasuryAmount,
        address paymentToken
    );

    // --- Structs ---

    enum SkillKind { AI_SKILL, AGENT_SKILL }

    struct SkillMetadata {
        uint256 skillId;
        SkillKind kind;
        address creator;
        bytes32 storageRoot;
        uint256 priceNative;
        uint256 priceUSDC;
        bool active;
    }

    struct ExecutionReceipt {
        bytes32 executionId;
        uint256 skillId;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 modelHash;       // keccak256 of model identifier string
        bool    teeVerified;     // true iff hardware TEE signed this receipt
        uint256 timestamp;
        address paidBy;
        address paymentToken;
        uint256 amountPaid;
    }

    // --- Core Methods ---

    /// @notice Register a new skill as an ERC-721 NFT
    function registerSkill(
        SkillKind kind,
        bytes32 storageRoot,
        uint256 priceNative,
        uint256 priceUSDC,
        string calldata metadataURI
    ) external returns (uint256 skillId);

    /// @notice Request execution — native 0G payment
    function requestExecution(
        uint256 skillId,
        bytes32 inputHash
    ) external payable returns (bytes32 executionId);

    /// @notice Request execution — ERC-20 payment (W0G or USDC.E)
    function requestExecutionWithToken(
        uint256 skillId,
        bytes32 inputHash,
        address token,
        uint256 amount
    ) external returns (bytes32 executionId);

    /// @notice Oracle calls this after TEE completes execution
    function confirmExecution(
        bytes32 executionId,
        bytes32 receiptRoot
    ) external;

    /// @notice Read skill metadata
    function getSkill(uint256 skillId) external view returns (SkillMetadata memory);

    /// @notice Verify a receipt root against an execution — anyone can call
    function verifyExecution(
        bytes32 executionId,
        bytes32 receiptRoot
    ) external view returns (bool valid);
}
```

---

### 3. Receipt Format

Every execution produces a receipt stored on 0G Storage. The on-chain root anchors it permanently. The receipt JSON must conform to this schema:

```json
{
  "smp": "1",
  "executionId": "<bytes32 hex>",
  "skillId": "<uint256>",
  "kind": "AI_SKILL | AGENT_SKILL",
  "model": "<string>",
  "modelHash": "<keccak256 of model string>",
  "inputHash": "<keccak256 of raw input>",
  "outputHash": "<keccak256 of raw output>",
  "output": "<string>",
  "teeAttestation": {
    "verified": true,
    "enclaveType": "IntelTDX | AMDSEV | SGX",
    "quote": "<hex-encoded TEE quote>",
    "timestamp": "<unix seconds>"
  },
  "payment": {
    "token": "<address | 'native'>",
    "amount": "<uint256 in token decimals>",
    "paidBy": "<address>"
  },
  "storageRoot": "<0G Storage root hash>"
}
```

For `AGENT_SKILL`, the receipt replaces `teeAttestation` with:

```json
{
  "bundleSha256": "<hex>",
  "bundleRootOnChain": "<bytes32>",
  "sha256Ok": true
}
```

#### Conformance note — reference implementation

The SkillMint reference oracle (v3, May 2026) currently writes receipts with **per-token flat fields** (`paidA0GI`, `paidW0G`, `paidUSDC`) rather than the unified `payment` object above. This is an implementation drift that predates SMP-1 finalization. The reference oracle will be upgraded to the unified `payment` shape in the next release; older receipts written under the flat-field convention remain verifiable via a backwards-compatibility shim in `@skillmint/sdk`'s `verifyReceipt()`.

New SMP-1 implementations should write the unified `payment` object from day one.

---

### 4. Payment Token Standard

SMP-1 compliant escrows must support three payment paths:

| Token | Path | Use Case |
|---|---|---|
| Native 0G | `requestExecution()` payable, PullPayment settlement | Humans, simple integrations |
| W0G (ERC-20 + EIP-3009) | `approve` + `requestExecutionWithToken` (dashboard) or EIP-3009 `transferWithAuthorization` + `requestExecutionPrefunded` (x402 gasless) | Agents over x402 |
| USDC.E (ERC-20 + EIP-3009 + EIP-2612) | Same two paths as W0G | Stablecoin preference, humans + agents |

Revenue split on every execution:
- **90%** → `ownerOf(skillId)` (current NFT holder)
- **10%** → Protocol treasury

---

### 5. Agent ID Integration (Recommended Extension)

We propose the 0G core team consider an optional `verifiedSkills` extension as the 0G Agent ID standard matures:

```json
{
  "agentId": "<ERC-721 token id>",
  "owner": "<address>",
  "verifiedSkills": [
    {
      "skillId": 2,
      "registry": "0xdF28e06899955092DF81f0DBea03496D1Ac8904E",
      "smp": "1",
      "lastExecution": "<receipt root hash>"
    }
  ]
}
```

This extension is **entirely optional** in SMP-1 and is shown only to illustrate a natural integration path. The 0G core team owns the Agent ID standard; SMP-1 makes no claim on it.

---

### 6. Verification Flow

Anyone — not just the original caller — can verify any execution, forever:

```
1. Read executionId from on-chain event log
2. Fetch receiptRoot from confirmExecution() transaction
3. Fetch receipt JSON from 0G Storage using root
4. Recompute inputHash and outputHash locally
5. Verify teeAttestation.quote using enclave vendor SDK
6. Check all hashes match → execution is valid
```

This is the core property SMP-1 guarantees: **trustless, permissionless, permanent verifiability.**

No one needs to trust SkillMint. No one needs to trust the operator. The TEE hardware and the on-chain root are the only trust anchors.

---

### 7. Skill Reputation (Informational)

SMP-1 does not mandate a reputation system. It defines the execution data that makes reputation possible:

- Every confirmed execution is a permanent on-chain event
- Reputation can be computed off-chain from execution history: success rate, caller diversity, volume
- Any third party can build a reputation indexer against SMP-1 compliant registries
- SkillMint maintains a reference reputation index at `reputation.skillmint.xyz`

The data moat is the execution history itself. After sufficient executions accumulate, no new entrant can replicate this without re-running the same history — which is impossible on a public chain.

---

## Rationale

### Why ERC-721 for skills?

Skills are non-fungible. Each skill has unique IP — a specific prompt or bundle — and unique revenue rights. ERC-721 provides standard ownership, transfer, and royalty mechanics (ERC-2981) without custom implementation. Transferring a skill NFT transfers its revenue stream. This makes skills tradeable assets, not just API endpoints.

### Why dual pricing (native + USDC)?

0G mainnet lacks a battle-tested price feed. Forcing USD-canonical pricing would require an oracle with new failure modes. Dual pricing lets publishers set explicit margins in both units. When Chainlink or equivalent price feeds land on 0G, USD-canonical becomes a one-line opt-in on top of this standard.

### Why TEE over ZK for execution privacy?

ZK proof generation for arbitrary AI inference is currently too slow and too expensive to be practical at agent speed. TEE provides hardware-level execution privacy with near-zero overhead. The tradeoff is trust in enclave hardware vendors (Intel, AMD) vs. trust in cryptographic assumptions. For 2026 production systems, TEE is the viable choice. SMP-1 does not preclude ZK-based verification as a future upgrade path.

### Why not just use 0G Compute directly?

0G Compute provides the execution environment. SMP-1 provides the standard contract interface, receipt format, payment rails, and NFT ownership layer on top of it. The two are complementary. 0G Compute is the infrastructure. SMP-1 is the protocol that makes it trustlessly composable.

---

## Backwards Compatibility

SMP-1 is a new standard. No existing 0G contracts are modified. Existing skill implementations that predate SMP-1 can choose to:

- Register as SMP-1 compliant by deploying a conforming registry
- Continue operating outside the standard (no compatibility breakage)

Non-compliant skills will appear as unverified in SMP-1 aware tooling. This is intentional — unverified execution should be visibly distinguishable from verified execution.

---

## Security Considerations

### TEE Compromise

TEEs have had known vulnerabilities (Spectre, Plundervolt, SGAxe). SMP-1 mitigates this by:

- Requiring fresh attestation quotes per execution (not cached)
- Making the enclave type explicit in every receipt
- Allowing callers to reject executions from enclave types they don't trust

### Malicious Oracle

The oracle that watches `ExecutionRequested` and calls `confirmExecution` is a trusted component. A malicious oracle could confirm executions that never ran inside a TEE. Mitigation:

- The TEE attestation quote inside the receipt is hardware-signed — a fake quote is cryptographically detectable
- Any caller can independently verify the quote using Intel/AMD's public attestation services
- Future SMP versions may propose a decentralized oracle network for this role

### Prompt Extraction

Skills store encrypted prompts on 0G Storage. The encryption key never leaves the TEE. A compromised TEE node could theoretically extract the key. This risk is documented explicitly and is bounded by TEE hardware security guarantees — the same guarantees used by confidential cloud computing products today.

### Front-running

`requestExecution` reveals the `inputHash` on-chain before execution. A sophisticated observer could derive the input. For high-sensitivity inputs, callers should encrypt inputs before hashing. SMP-1 does not mandate input encryption but does not preclude it.

---

## Reference Implementation

SkillMint Protocol provides the reference implementation of SMP-1:

| Component | Network | Address / Location |
|---|---|---|
| SkillRegistryV3 (ERC-721) | 0G Aristotle Mainnet (16661) | `0xdF28e06899955092DF81f0DBea03496D1Ac8904E` |
| SkillEscrowV3 | 0G Aristotle Mainnet (16661) | `0xA0e5A7d722399f59A0Ee4B8DF740107FBC63f7ae` |
| DemoW0G (Wrapped 0G with EIP-3009) | 0G Aristotle Mainnet (16661) | `0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01` |
| USDC.E (XSwap-bridged Circle FiatToken v2) | 0G Aristotle Mainnet (16661) | `0x1f3aa82227281ca364bfb3d253b0f1af1da6473e` |
| SkillRegistryV3 | 0G Galileo Testnet (16602) | `0xe052332AA56c179FF9A8B2bCFCCb5679d2BCe9d3` |
| SkillEscrowV3 | 0G Galileo Testnet (16602) | `0x4ca3Fe8a467C734c31a34a345F6819e5767cAD9C` |
| MockUSDC (testnet 6-decimal stand-in · public mint) | 0G Galileo Testnet (16602) | `0x1605FF6E8aB0Bd7F846cf99268B669764F981C06` |
| TypeScript SDK | — | `npm install @skillmint/sdk` |
| Live dashboard | — | `skillmint-0g.vercel.app` |
| Source + docs | — | `github.com/ayushsaklani-min/SkillMint` |

The reference implementation is MIT licensed. Any party may fork, extend, or build conforming implementations.

---

## Adoption Path

SMP-1 becomes valuable in proportion to how many agents and registries adopt it. The proposed adoption sequence:

1. **Public draft** — publish this proposal, invite community comment, iterate
2. **3 anchor integrations** — projects that consume `@skillmint/sdk` in production
3. **Public verification dashboard** — showing verified vs unverified execution across 0G
4. **0G Agent ID extension discussion** — open conversation with 0G core team on the optional `verifiedSkills` field
5. **Ecosystem reference** *(aspirational)* — new 0G projects voluntarily reference SMP-1 as a baseline expectation

Steps 1-3 are entirely within SkillMint's control. Steps 4-5 require ecosystem participation; SMP-1 cannot force adoption and does not attempt to.

---

## Copyright

This SMP is placed in the public domain via CC0. The reference implementation is MIT licensed.

---

*SMP-1 Draft · SkillMint Protocol · May 2026*
*Built on 0G Network · TEE Attested · Permanently Verifiable*
*Feedback: github.com/ayushsaklani-min/SkillMint/discussions · X: @ayushsaklani976*
