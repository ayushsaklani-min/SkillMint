<div align="center">

<img src="frontend/public/logo.png.png" alt="SkillMint" width="200"/>

# ![SKILL](https://img.shields.io/badge/SKILL-0038FF?style=for-the-badge&labelColor=0038FF)![MINT](https://img.shields.io/badge/MINT-D4FF00?style=for-the-badge&labelColor=D4FF00)

### The Verified AI Skill Execution Protocol

*Every execution **TEE-attested**. Every payment **automatic**. Every result **provable**.*
*Pay in **0G**, **W0G**, or **USDC.E** — humans through dashboard escrow, agents through W0G x402.*

<br/>

![Built on 0G](https://img.shields.io/badge/BUILT_ON-0G_ARISTOTLE_MAINNET-0038FF?style=for-the-badge&labelColor=000000)
![TEE Attested](https://img.shields.io/badge/TEE-ATTESTED-D4FF00?style=for-the-badge&labelColor=000000)
![USDC.E](https://img.shields.io/badge/PAYMENTS-0G_·_W0G_·_USDC.E-20C20E?style=for-the-badge&labelColor=000000)
![Hackathon](https://img.shields.io/badge/0G_APAC-HACKATHON_2026-0038FF?style=for-the-badge&labelColor=000000)
![Status](https://img.shields.io/badge/STATUS-LIVE_ON_MAINNET_V3-D4FF00?style=for-the-badge&labelColor=000000)

<br/>

**[▶ Live App](https://skillmint-0g.vercel.app)** · **[📖 Explainer](https://skillmint-0g.vercel.app/explainer)** · **[🎬 Demo Video](https://youtu.be/GOKLc4FmP5Q)** · **[🎤 Pitch Video](https://www.youtube.com/watch?v=CE35T3lOz4Q)** · **[𝕏 @ayushsaklani976](https://x.com/ayushsaklani976)** · **[Reviewer Guide](REVIEWER.md)** · **[📜 SMP-1 Draft](https://github.com/ayushsaklani-min/SkillMint/blob/main/SMP-1-SkillMint-Verified-Skill-Standard.md)** · **[🔗 0G ChainScan](https://chainscan.0g.ai)** · **[📂 0G StorageScan](https://storagescan.0g.ai)**

**Build threads on 𝕏:** [📐 SMP-1 announcement](https://x.com/ayushsaklani976/status/2053838755690328535) · [🧵 Build update](https://x.com/ayushsaklani976/status/2052806286681719137) · [🚀 Earlier thread](https://x.com/ayushsaklani976/status/2048764755863900452)

</div>

---

## ![WHY NOW](https://img.shields.io/badge/🚨-WHY_NOW-FF0000?style=for-the-badge&labelColor=000000)

**ClawHavoc. Early 2026.**

539 malicious skills uploaded to ClawHub — the official marketplace for the OpenClaw agent framework. Nearly **19% of popular agent skills compromised**. Attackers poisoned the ecosystem with skills that harvested credentials, exfiltrated memory files (`SOUL.md`, `MEMORY.md`), opened reverse shells, and modified agent behavior while appearing completely normal.

No attestation. No receipt. No way to tell a legitimate execution from a compromised one.

> *"The trust problem isn't coming. It already failed publicly. SkillMint exists because unverified execution is a structural vulnerability — not a one-off bug. We're building the verification layer before the next ClawHavoc happens at 10x scale."*

| ClawHavoc Attack Vector | SkillMint Defense |
|---|---|
| Malicious skills masquerading as legitimate | TEE attests exact skill hash — impersonation impossible |
| Memory poisoning (SOUL.md / MEMORY.md theft) | Prompts encrypted on 0G Storage, never exposed to anyone |
| No proof of what actually ran | On-chain receipt proves model + prompt + output, forever |
| 19% of skills compromised, undetected | Every execution independently verifiable by anyone |
| Supply-chain attack via open marketplace | NFT ownership + encrypted prompt = tamper-proof provenance |

---

## ![THE PROBLEM](https://img.shields.io/badge/⚡-THE_PROBLEM-0038FF?style=for-the-badge&labelColor=000000)

AI models are **black boxes**. When an agent calls an AI and gets back a result, there's no proof of *which* model ran, *what prompt* it was given, or whether the output was tampered with. In agentic systems where money moves on every hop, this is structurally broken.

## ![THE FIX](https://img.shields.io/badge/✨-THE_FIX-D4FF00?style=for-the-badge&labelColor=000000)

**SkillMint** turns AI system prompts into tradeable **ERC-721 NFTs**, then wraps every execution in a **Trusted Execution Environment** (TEE) on the 0G network. Every output ships with a hardware-signed receipt that's cryptographically impossible to fake. Skills carry **two prices on-chain** (0G + USDC.E), and both humans and agents can pay in any of three assets.

```
┌──────────┐  pay 0G/W0G/USDC.E  ┌──────────────┐   verified output    ┌──────────┐
│  AGENT   ├────────────────────▶│  TEE  RUNS   ├─────────────────────▶│  AGENT   │
│  HUMAN   │      + input        │  SKILL NFT   │   + TEE attestation  │  (happy) │
└──────────┘                     └──────┬───────┘                      └──────────┘
                                        │
                            ┌───────────┴────────────┐
                            ▼                        ▼
                   ┌────────────────┐       ┌──────────────────┐
                   │ 90% → NFT      │       │ Receipt →        │
                   │    OWNER       │       │   0G STORAGE     │
                   │ 10% → PROTOCOL │       │ (root on-chain)  │
                   └────────────────┘       └──────────────────┘
```

## ![WHY TEE](https://img.shields.io/badge/🔐-WHY_TEE-0038FF?style=for-the-badge&labelColor=000000)

A **TEE** is a hardware-isolated enclave (Intel SGX / AMD SEV) on 0G Compute nodes. Code runs inside a locked glass box — nobody, not even the server operator, can peek in or modify what's happening. The TEE signs a **cryptographic attestation** proving the exact model + prompt + output, giving agents trustless provenance. No ClawHavoc-style memory poisoning. No tampered outputs. No silent compromise.

## ![WHY NFT](https://img.shields.io/badge/🛡-WHY_NFT-D4FF00?style=for-the-badge&labelColor=000000)

Every skill is an **ERC-721** with its prompt stored **encrypted** on 0G Storage. Buyers execute it but **never see the prompt** — they only see the output. Creators keep their IP secret while earning royalties forever. Transfer the NFT → revenue follows.

## ![ARCHITECTURE](https://img.shields.io/badge/🧱-ARCHITECTURE-0038FF?style=for-the-badge&labelColor=000000)

| Package            | What's Inside                                                          |
|--------------------|------------------------------------------------------------------------|
| **`contracts/`**   | `SkillRegistryV3` (ERC-721 + dual-price + asset-aware `priceFor`) · `SkillEscrowV3` (multi-token: native PullPayment + ERC-20 push, `FACILITATOR_ROLE`, `unallocatedTokenBalance` bookkeeping) |
| **`oracle/`**      | Event watcher → 0G Compute TEE → receipt on 0G Storage → on-chain confirm; reads `paymentToken` per execution and stamps it into the receipt |
| **`facilitator/`** | x402 facilitator — multi-asset `/supported`, `/verify`, `/settle` (W0G + USDC.E) |
| **`frontend/`**    | Next.js 16 · neo-brutalist UI · ethers.js · 3-button payment-token selector · publish-form CoinGecko auto-fill |
| **`sdk/`**         | TypeScript SDK · `@skillmint/sdk` — `listSkills` · `execute({paymentToken})` · `executeX402` (W0G + USDC.E) · `downloadAgentSkill` · `verifyReceipt` · `registerSkill` (dual price) |
| **`skills/`**      | Seed skill registry + `register-all.js` bootstrap                      |
| **`shared/`**      | ABIs (V3 + USDC) + network config with `tokens` map (testnet ↔ mainnet) |
| **`tee-sandbox/`** | Standalone TEE compute test harness                                    |

## ![EXECUTION FLOW](https://img.shields.io/badge/🔁-EXECUTION_FLOW-D4FF00?style=for-the-badge&labelColor=000000)

1. **Creator** publishes a skill → mints `SkillRegistryV3` NFT with **two prices** (`priceA0GI` + `priceUSDC`), prompt encrypted on 0G Storage
2. **Caller picks a token**:
   - **Native 0G** → `escrow.requestExecution(skillId, input)` payable
   - **W0G** (ERC-20 dashboard) → `approve` + `escrow.requestExecutionWithToken(skillId, input, w0g, amount)`
   - **USDC.E** (ERC-20 dashboard) → `approve` + `escrow.requestExecutionWithToken(skillId, input, usdc, amount)`
   - **W0G via x402** (agent flow) → SDK wraps native 0G into W0G if needed, signs EIP-3009 `transferWithAuthorization`, and the facilitator settles the signed payment
3. **For escrow executions**, the oracle watches `ExecutionRequested(... paymentToken)` and forwards to 0G Compute TEE
4. **TEE** runs the skill, returns signed output + attestation
5. **For escrow executions**, the oracle uploads the receipt to 0G Storage with the right `paid*` field and calls `confirmExecution(executionId, root)` on-chain
6. **Escrow** releases 90% to `ownerOf(skillId)`, 10% to protocol for dashboard/direct-SDK executions — native via PullPayment, ERC-20 via push transfer
7. **For x402 executions**, the x402 server verifies payment, runs the skill, uploads the receipt to 0G Storage, and returns the receipt root plus settlement transaction to the agent
8. **Anyone** can verify the receipt against the receipt root — escrow executions anchor it on-chain, and x402 executions return it with the settlement response

## ![AGENT SDK](https://img.shields.io/badge/📦-AGENT_SDK-D4FF00?style=for-the-badge&labelColor=000000)

**`@skillmint/sdk`** — TypeScript client for agents. Two skill kinds, three payment tokens:
- **AI skills** (prompt) — direct SDK/dashboard execution can pay with native 0G, W0G, or USDC.E; x402 agent execution uses W0G on the public endpoint, runs inside a 0G Compute TEE, and verifies the signed receipt.
- **Agent skills** (folder bundles) — buy through x402, download an encrypted `.skill` zip (Anthropic Claude / Codex / Cursor compatible), and sha256-verify locally. The public x402 endpoint advertises W0G; the SDK/facilitator can also handle USDC.E when an endpoint advertises USDC.E.

Defaults point at the live Vercel-proxied backend, so no URL configuration is required.

```bash
npm install @skillmint/sdk ethers
```

```typescript
import { SkillMintClient, PaymentToken } from "@skillmint/sdk";

const client = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "mainnet",   // default — pass "testnet" for Galileo
});

// 1. Discover — every skill exposes both prices
const skills = await client.listSkills();
//   skills[0].price       → "0.001"  (0G, human-readable)
//   skills[0].priceUSDC   → "0.01"   (USDC.E, human-readable; "0" if disabled)
//   skills[0].priceUSDCRaw → 10000n  (6-decimal units)

// 2a. Direct dashboard execution — pick a token (defaults to Native)
const r1 = await client.execute(2, "How do I deploy on 0G?", { paymentToken: PaymentToken.USDC });
//   sends approve + requestExecutionWithToken under the hood;
//   pays exactly skill.priceUSDC USDC.E to the escrow.

// 2b. Agent execution via x402 — EIP-3009 payment authorization. The public
//     SkillMint x402 endpoint advertises W0G. If the wallet has native 0G but
//     not enough W0G, the SDK auto-wraps 0G -> W0G before signing.
const result = await client.executeX402(
  2,                                                   // skillId — "0G Expert" on mainnet
  "How do I deploy a contract to 0G chain using hardhat?"
);
console.log(result.output);
console.log("settle tx :", result.settlement.transaction);
console.log("receipt   :", result.receiptRootHash);
console.log("paid       :", result.paidW0G !== "0" ? `${result.paidW0G} W0G` : `${result.paidUSDC} USDC.E`);

// 3. Verify the receipt — anyone can. Recomputes input/output hashes,
//    checks the TEE-attestation flag from inside the enclave.
const receipt = await client.fetchReceipt(result.receiptRootHash);
const v = client.verifyReceipt(receipt);
// → { valid: true, inputHashOk: true, outputHashOk: true, teeVerified: true }
```

```typescript
// agent-skill flow — buy + download an Anthropic-format Claude Skill bundle
const dl = await client.downloadAgentSkill(21);   // skill #21 = "fhenix-dev"
dl.bundle           // ← decrypted .skill zip bytes
dl.bundleSha256     // ← anchored on-chain, recomputed locally to detect tampering
dl.manifest         // ← ["SKILL.md", "references/architecture.md", ...]
dl.settlement.transaction

// Verify the bundle matches the on-chain commitment, byte-for-byte
const r = await client.fetchReceipt(dl.receiptRootHash);
client.verifyReceipt(r, { bundle: dl.bundle });
// → { kind: "agent-skill", sha256Ok: true, valid: true }

// Or extract straight to disk (uses adm-zip)
await client.downloadAgentSkill(21, { extractTo: "./fhenix-dev" });

// Publishing your own — multipart upload, encrypted on 0G Storage, sha256
// + storage root anchored in the NFT metadata
await client.registerAgentSkill({
  bundle: "./my-skill.skill",          // path or Buffer/Uint8Array
  name: "my-skill",
  description: "...",
  price: "0.005",                      // W0G per download
  format: "claude-skill",
  compatibleWith: ["claude-code", "cursor", "codex"],
});
```

| Surface          | Methods |
|------------------|---------|
| **Discovery**    | `listSkills` · `searchSkills` · `resolveSkill` · `getSkill` (returns both prices) · `getReputation` |
| **AI skills**    | `execute(id, input, { paymentToken })` (Native / W0G / USDC) · `executeX402` (public W0G x402; SDK accepts W0G/USDC.E challenges) · `executeAndWait` · `getExecutionOutcome` |
| **Agent skills** | `registerAgentSkill` (publish folder bundle) · `downloadAgentSkill` (buy + sha256-verify) |
| **W0G**          | `wrapW0G` · `unwrapW0G` · `getW0GBalance` |
| **Receipts**     | `fetchReceipt` · `verifyReceipt` (works on both kinds; pass `{ bundle }` for agent skills) |
| **Publish**      | `registerSkill` (prompt; takes `priceA0GI` + `priceUSDC`) · `registerAgentSkill` (folder bundle) |
| **Owner**        | `updatePrice(id, priceA0GI, priceUSDC)` (atomic dual-price update) · `deactivateSkill` · `transferSkill` · `withdrawRevenue` |

Runnable end-to-end examples — discovers skills, picks one, pays via x402, verifies the receipt — live at [`sdk/examples/agent-run.mjs`](sdk/examples/agent-run.mjs) (prompt skill) and [`sdk/examples/agent-skill-e2e.mjs`](sdk/examples/agent-skill-e2e.mjs) (agent skill, end-to-end on Galileo). Zero URL overrides.

## ![SKILL KINDS](https://img.shields.io/badge/🧬-SKILL_KINDS-0038FF?style=for-the-badge&labelColor=000000)

| Kind | What it is | Trust guarantee |
|---|---|---|
| **AI Skill** (prompt) | A system prompt run inside a TEE (0G Compute hardware enclave) | TEE attestation — model + prompt + output cryptographically signed by the enclave |
| **Agent Skill** (folder) | A `.skill` zip bundle (SKILL.md + reference markdown), Claude Code / Codex / Cursor compatible | Tamper-proof distribution — sha256 of the bundle is anchored on-chain; download verifies byte-for-byte |

## ![PAYMENT TOKENS](https://img.shields.io/badge/💸-PAYMENT_TOKENS-20C20E?style=for-the-badge&labelColor=000000)

V3 skills carry **two on-chain prices** independently — `priceA0GI` (native 0G wei, also the W0G price 1:1) and `priceUSDC` (6-decimal USDC.E units). Publishers set both at mint time; the publish form auto-fills the 0G price from a live CoinGecko quote. `priceUSDC = 0` is a sentinel meaning "USDC payments disabled for this skill."

| Token | Decimals | Path | Who pays |
|---|---|---|---|
| **Native 0G** | 18 | `escrow.requestExecution()` payable, settles via OpenZeppelin `PullPayment` | Humans on the dashboard; SDK direct execution can also use it |
| **W0G** (DemoW0G with EIP-3009) | 18 | `approve` + `requestExecutionWithToken` for escrow execution, or EIP-3009 `transferWithAuthorization` for x402 agent execution | Humans + agents |
| **USDC.E** (XSwap-bridged Circle FiatToken v2) | 6 | `approve` + `requestExecutionWithToken` for escrow execution; supported by SDK/facilitator when an x402 endpoint advertises it | Humans + agents |

### SDK + W0G x402 Architecture

Native 0G is the base asset of the chain, but native coins cannot sign EIP-3009 authorizations. Agent payments therefore use **W0G**, an ERC-20 wrapper around native 0G. From the agent's point of view, the payment is still 0G-denominated because `priceA0GI` is used for both native 0G and W0G at a 1:1 rate.

```text
                         PUBLISH TIME

  Creator wallet
      |
      | registerSkill(promptHash, provider, model, priceA0GI, priceUSDC, metadata)
      v
  SkillRegistryV3
      |
      | stores:
      | - owner/developer
      | - prompt hash
      | - encrypted 0G Storage root in metadata
      | - priceA0GI  (native 0G wei, also W0G price)
      | - priceUSDC  (6-decimal USDC.E units, 0 = disabled)
      v
  Skill NFT


                         HUMAN / DASHBOARD PAYMENT

  Browser wallet
      |
      | chooses payment asset
      |
      +-- Native 0G ----------------------------------------------+
      |                                                           |
      | escrow.requestExecution(skillId, inputHash)               |
      | msg.value = priceA0GI                                     |
      |                                                           v
      |                                                     SkillEscrowV3
      |                                                           |
      +-- W0G / USDC.E ------------------------------------------+
          approve(escrow, amount)
          escrow.requestExecutionWithToken(skillId, inputHash, token, amount)
          amount = priceA0GI for W0G
          amount = priceUSDC for USDC.E

  SkillEscrowV3
      |
      | emits ExecutionRequested(executionId, skillId, caller, inputHash, amount, paymentToken)
      v
  Oracle
      |
      | reads real input from /input
      | runs skill through 0G Compute / TEE path
      | uploads receipt to 0G Storage
      v
  escrow.confirmExecution(executionId, receiptRoot)
      |
      | Native 0G: PullPayment balances are credited
      | W0G/USDC.E: ERC-20 push transfer
      v
  90% skill NFT owner / 10% protocol treasury


                         AGENT / SDK x402 PAYMENT

  Agent process using @skillmint/sdk
      |
      | client.executeX402(skillId, input)
      v
  POST /skill/:id/execute without X-PAYMENT
      |
      v
  x402 skill server returns HTTP 402
      |
      | paymentRequirements:
      | - asset = W0G
      | - maxAmountRequired = priceA0GI
      | - payTo = current skill NFT owner
      | - resource = /skill/:id/execute
      v
  SDK checks agent wallet W0G balance
      |
      +-- enough W0G -----------------------------+
      |                                           |
      +-- not enough W0G                          |
          |
          | W0G.deposit{ value: shortfall + buffer }()
          | wraps native 0G -> W0G
          v
  SDK signs EIP-3009 TransferWithAuthorization
      |
      | from  = agent wallet
      | to    = skill NFT owner
      | value = priceA0GI in W0G units
      | nonce = random bytes32
      v
  POST /skill/:id/execute with X-PAYMENT header
      |
      v
  x402 server
      |
      | asks facilitator /verify:
      | - signature valid
      | - nonce unused
      | - W0G balance sufficient
      v
  0G Compute / TEE execution
      |
      | server builds receipt:
      | - inputHash
      | - outputHash
      | - model/provider
      | - teeVerified flag
      | - paidW0G
      v
  Receipt uploaded to 0G Storage
      |
      v
  Facilitator /settle
      |
      | W0G.transferWithAuthorization(agent -> skill owner)
      v
  SDK receives:
      |
      | - verified output
      | - receiptRootHash
      | - settlement transaction
      | - X-PAYMENT-RESPONSE
      v
  Agent can verify receipt with client.fetchReceipt() + client.verifyReceipt()
```

The key distinction is that **native 0G is used directly for dashboard/direct SDK escrow execution**, while **agent x402 execution uses W0G**. If the agent wallet starts with native 0G, the SDK wraps it into W0G first, then signs the x402 payment authorization.

The escrow uses an `unallocatedTokenBalance[token]` mapping to bookkeep ERC-20 deposits across token-based escrow executions. Every escrow settle/refund decrements this so the invariant always equals "ERC-20 balance committed to known executions." The V3 contract also includes a `requestExecutionPrefunded(...)` path for facilitator-style prefunded escrow accounting, while the public x402 skill endpoint currently settles W0G through EIP-3009 and returns the settlement transaction directly to the agent.

**Why dual price (not USD-canonical)?** 0G mainnet is too new to have a battle-tested USD price feed. Dual-price ships zero new on-chain failure modes; publishers control margins explicitly. When Chainlink price feeds land, USD-canonical pricing becomes a one-line opt-in.

**Why a custom W0G?** The canonical 0G `Wrapped0GBase` precompile lacks EIP-3009 `transferWithAuthorization`. SkillMint deploys its own DemoW0G wrapper (1:1 with native, plus EIP-3009) so x402 actually works against W0G. USDC.E ships with EIP-3009 out of the box (Circle FiatToken v2), so no shim there.

## ![LIVE DEPLOYMENT](https://img.shields.io/badge/🌐-LIVE_DEPLOYMENT-D4FF00?style=for-the-badge&labelColor=000000)

> **Status:** ![Mainnet](https://img.shields.io/badge/0G_ARISTOTLE_MAINNET-LIVE_V3-20C20E?style=flat-square&labelColor=000000) · ![Testnet](https://img.shields.io/badge/0G_GALILEO-V3-D4FF00?style=flat-square&labelColor=000000) — running on **0G Aristotle Mainnet** (chainId `16661`). Testnet `16602` mirrors mainnet shape with a MockUSDC stand-in.
>
> Skill IDs from V2 are being re-published on V3 by their original publishers. The dashboard at [`skillmint-0g.vercel.app`](https://skillmint-0g.vercel.app) is the live source of truth for current V3 skill numbering.

### Mainnet (0G Aristotle · chainId 16661)

| Component | Address |
|-----------|---------|
| **Frontend** | [`skillmint-0g.vercel.app`](https://skillmint-0g.vercel.app) · Vercel |
| **Oracle / Facilitator / x402 server** | AWS EC2 · `ap-south-1` · systemd |
| **SkillRegistryV3** | `0xdF28e06899955092DF81f0DBea03496D1Ac8904E` · [ChainScan](https://chainscan.0g.ai/address/0xdF28e06899955092DF81f0DBea03496D1Ac8904E) |
| **SkillEscrowV3** | `0xA0e5A7d722399f59A0Ee4B8DF740107FBC63f7ae` · [ChainScan](https://chainscan.0g.ai/address/0xA0e5A7d722399f59A0Ee4B8DF740107FBC63f7ae) |
| **DemoW0G** (Wrapped 0G · EIP-3009) | `0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01` · [ChainScan](https://chainscan.0g.ai/address/0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01) |
| **USDC.E** (XSwap-bridged Circle FiatToken v2 · EIP-3009 + EIP-2612) | `0x1f3aa82227281ca364bfb3d253b0f1af1da6473e` · [ChainScan](https://chainscan.0g.ai/address/0x1f3aa82227281ca364bfb3d253b0f1af1da6473e) |
| **TEE compute** | qwen3-vl-30b · deepseek-v3 · GLM-5-FP8 · gpt-5.4-mini |

> **Retired V2 (still on chain, no longer referenced by SkillMint):** `SkillRegistryV2` `0x14cE…8F09` · `SkillEscrowV2` `0xD738…8Ea5`.

### Testnet (0G Galileo · chainId 16602)

| Component | Address |
|-----------|---------|
| **SkillRegistryV3** | `0xe052332AA56c179FF9A8B2bCFCCb5679d2BCe9d3` · [Galileo ChainScan](https://chainscan-galileo.0g.ai/address/0xe052332AA56c179FF9A8B2bCFCCb5679d2BCe9d3) |
| **SkillEscrowV3** | `0x4ca3Fe8a467C734c31a34a345F6819e5767cAD9C` · [Galileo ChainScan](https://chainscan-galileo.0g.ai/address/0x4ca3Fe8a467C734c31a34a345F6819e5767cAD9C) |
| **W0G** (Wrapped 0G · EIP-3009) | `0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D` · [Galileo ChainScan](https://chainscan-galileo.0g.ai/address/0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D) |
| **MockUSDC** (testnet 6-decimal stand-in · public mint) | `0x1605FF6E8aB0Bd7F846cf99268B669764F981C06` · [Galileo ChainScan](https://chainscan-galileo.0g.ai/address/0x1605FF6E8aB0Bd7F846cf99268B669764F981C06) |

## ![DESIGN](https://img.shields.io/badge/🎨-DESIGN-0038FF?style=for-the-badge&labelColor=000000)

Neo-brutalism. **Electric blue** `#0038FF` · **Acid lime** `#D4FF00` · **Parrot green** `#20C20E` · hard black 4px shadows · **Archivo Black** display type.

## ![LICENSE](https://img.shields.io/badge/📜-LICENSE-D4FF00?style=for-the-badge&labelColor=000000)

MIT — build freely.

<div align="center">
<br/>

![Hackathon](https://img.shields.io/badge/MADE_FOR-0G_APAC_HACKATHON_2026-0038FF?style=for-the-badge&labelColor=D4FF00)

<sub>**SKILLMINT PROTOCOL · VERIFIED AI SKILL EXECUTION**</sub>

</div>
