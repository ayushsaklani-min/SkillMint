<div align="center">

<img src="frontend/public/logo.png.png" alt="SkillMint" width="200"/>

# ![SKILL](https://img.shields.io/badge/SKILL-0038FF?style=for-the-badge&labelColor=0038FF)![MINT](https://img.shields.io/badge/MINT-D4FF00?style=for-the-badge&labelColor=D4FF00)

### The Verified AI Skill Execution Protocol

*Every execution **TEE-attested**. Every payment **automatic**. Every result **provable**.*

<br/>

![Built on 0G](https://img.shields.io/badge/BUILT_ON-0G_GALILEO-0038FF?style=for-the-badge&labelColor=000000)
![TEE Attested](https://img.shields.io/badge/TEE-ATTESTED-D4FF00?style=for-the-badge&labelColor=000000)
![Hackathon](https://img.shields.io/badge/0G_APAC-HACKATHON_2026-0038FF?style=for-the-badge&labelColor=000000)
![Status](https://img.shields.io/badge/STATUS-LIVE-D4FF00?style=for-the-badge&labelColor=000000)

<br/>

**[▶ Live App](https://skillmint-0g.vercel.app)** · **[📖 Explainer](https://skillmint-0g.vercel.app/explainer)** · **[🔗 0G ChainScan](https://chainscan-galileo.0g.ai)** · **[📂 0G StorageScan](https://storagescan-galileo.0g.ai)**

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

**SkillMint** turns AI system prompts into tradeable **ERC-721 NFTs**, then wraps every execution in a **Trusted Execution Environment** (TEE) on the 0G network. Every output ships with a hardware-signed receipt that's cryptographically impossible to fake.

```
┌──────────┐   pay OG    ┌──────────────┐   verified output    ┌──────────┐
│  AGENT   ├────────────▶│  TEE  RUNS   ├─────────────────────▶│  AGENT   │
│          │  + input    │  SKILL NFT   │   + TEE attestation  │  (happy) │
└──────────┘             └──────┬───────┘                      └──────────┘
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
| **`contracts/`**   | `SkillRegistryV2` (ERC-721 + ERC-2981) · `SkillEscrowV2` (PullPayment) |
| **`oracle/`**      | Event watcher → 0G Compute TEE → receipt on 0G Storage → on-chain confirm |
| **`frontend/`**    | Next.js 16 · neo-brutalist UI · ethers.js · scroll-driven explainer    |
| **`sdk/`**         | TypeScript SDK · `@skillmint/sdk` — `listSkills` · `executeX402` · `downloadAgentSkill` · `verifyReceipt` · `registerSkill` · `registerAgentSkill` |
| **`skills/`**      | Seed skill registry + `register-all.js` bootstrap                      |
| **`shared/`**      | ABIs + network config (testnet ↔ mainnet)                              |
| **`tee-sandbox/`** | Standalone TEE compute test harness                                    |

## ![EXECUTION FLOW](https://img.shields.io/badge/🔁-EXECUTION_FLOW-D4FF00?style=for-the-badge&labelColor=000000)

1. **Creator** publishes a skill → mints `SkillRegistryV2` NFT, prompt encrypted on 0G Storage
2. **Agent** calls `SkillEscrow.requestExecution(skillId, input)` with OG payment
3. **Oracle** watches `ExecutionRequested`, forwards to 0G Compute TEE
4. **TEE** runs the skill, returns signed output + attestation
5. **Oracle** uploads receipt to 0G Storage, calls `confirmExecution(root)` on-chain
6. **Escrow** releases 90% to `ownerOf(skillId)`, 10% to protocol
7. **Anyone** can verify the receipt against the on-chain root — forever

## ![QUICK START](https://img.shields.io/badge/🚀-QUICK_START-0038FF?style=for-the-badge&labelColor=000000)

```bash
# Frontend — localhost:3000
cd frontend && npm install --legacy-peer-deps && npm run dev

# Oracle — watch + confirm executions
cd oracle && npm install && cp .env.example .env && npm start

# Contracts — tests
cd contracts && npm install && npx hardhat test

# Deploy to 0G Galileo
cd contracts && npx hardhat run scripts/deploy-v2.js --network galileo
```

## ![AGENT SDK](https://img.shields.io/badge/📦-AGENT_SDK-D4FF00?style=for-the-badge&labelColor=000000)

**`@skillmint/sdk`** — TypeScript client for agents. Two skill kinds:
- **AI skills** (prompt) — pay with W0G via [x402](https://x402.org), run inside a 0G Compute TEE, verify the signed receipt.
- **Agent skills** (folder bundles) — pay with W0G, download an encrypted `.skill` zip (Anthropic Claude / Codex / Cursor compatible), sha256-verify locally.

Defaults point at the live Vercel-proxied backend, so no URL configuration is required.

```bash
npm install @skillmint/sdk ethers
```

```typescript
import { SkillMintClient } from "@skillmint/sdk";

const client = new SkillMintClient({
  privateKey: process.env.PRIVATE_KEY!,
  network: "testnet",
});

// 1. Discover
const skills = await client.listSkills();

// 2. Execute via x402 — auto-wraps native 0G into W0G if balance is short,
//    signs an EIP-3009 authorization, settles on-chain, returns the output.
const result = await client.executeX402(
  15,                                                  // skillId
  "pragma solidity ^0.8.0; contract A { /* ... */ }"   // input
);
console.log(result.output);
console.log("settle tx :", result.settlement.transaction);
console.log("receipt   :", result.receiptRootHash);

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
| **Discovery**    | `listSkills` · `searchSkills` · `resolveSkill` · `getSkill` · `getReputation` |
| **AI skills**    | `executeX402` (x402 + W0G) · `executeAndWait` (native escrow) · `getExecutionOutcome` |
| **Agent skills** | `registerAgentSkill` (publish folder bundle) · `downloadAgentSkill` (buy + sha256-verify) |
| **W0G**          | `wrapW0G` · `unwrapW0G` · `getW0GBalance` |
| **Receipts**     | `fetchReceipt` · `verifyReceipt` (works on both kinds; pass `{ bundle }` for agent skills) |
| **Publish**      | `registerSkill` (prompt) · `registerAgentSkill` (folder bundle) |
| **Owner**        | `updatePrice` · `deactivateSkill` · `transferSkill` · `withdrawRevenue` |

Runnable end-to-end examples — discovers skills, picks one, pays via x402, verifies the receipt — live at [`sdk/examples/agent-run.mjs`](sdk/examples/agent-run.mjs) (prompt skill) and [`sdk/examples/agent-skill-e2e.mjs`](sdk/examples/agent-skill-e2e.mjs) (agent skill, end-to-end on Galileo). Zero URL overrides.

## ![SKILL KINDS](https://img.shields.io/badge/🧬-SKILL_KINDS-0038FF?style=for-the-badge&labelColor=000000)

| Kind | What it is | Trust guarantee |
|---|---|---|
| **AI Skill** (prompt) | A system prompt run inside a TEE (0G Compute hardware enclave) | TEE attestation — model + prompt + output cryptographically signed by the enclave |
| **Agent Skill** (folder) | A `.skill` zip bundle (SKILL.md + reference markdown), Claude Code / Codex / Cursor compatible | Tamper-proof distribution — sha256 of the bundle is anchored on-chain; download verifies byte-for-byte |

## ![LIVE DEPLOYMENT](https://img.shields.io/badge/🌐-LIVE_DEPLOYMENT-D4FF00?style=for-the-badge&labelColor=000000)

> **Status:** ![Testnet](https://img.shields.io/badge/TESTNET-LIVE-20C20E?style=flat-square&labelColor=000000) · ![Mainnet](https://img.shields.io/badge/0G_MAINNET-NEXT-D4FF00?style=flat-square&labelColor=000000) — actively running on 0G Galileo Testnet. Mainnet contracts deploy as the next milestone.
>
> **Live agent-skill demo:** `fhenix-dev` (FHE blockchain knowledge bundle) is published as skill #21 — `await client.downloadAgentSkill(21)` to buy + verify it end-to-end.

| Component | Where |
|-----------|-------|
| **Frontend** | [`skillmint-0g.vercel.app`](https://skillmint-0g.vercel.app) · Vercel |
| **Oracle / Facilitator / x402 server** | AWS EC2 · `ap-south-1` · systemd |
| **SkillRegistryV2** | `0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4` · [0G ChainScan](https://chainscan-galileo.0g.ai/address/0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4) |
| **SkillEscrowV2** | `0xe2841b105B695610f2c1194f8865474A536184dB` · [0G ChainScan](https://chainscan-galileo.0g.ai/address/0xe2841b105B695610f2c1194f8865474A536184dB) |
| **W0G** (Wrapped 0G · EIP-3009) | `0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D` · [0G ChainScan](https://chainscan-galileo.0g.ai/address/0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D) |
| **Network** | 0G Galileo Testnet · Chain ID `16602` (mainnet `16661` next) |

## ![DESIGN](https://img.shields.io/badge/🎨-DESIGN-0038FF?style=for-the-badge&labelColor=000000)

Neo-brutalism. **Electric blue** `#0038FF` · **Acid lime** `#D4FF00` · **Parrot green** `#20C20E` · hard black 4px shadows · **Archivo Black** display type.

## ![LICENSE](https://img.shields.io/badge/📜-LICENSE-D4FF00?style=for-the-badge&labelColor=000000)

MIT — build freely.

<div align="center">
<br/>

![Hackathon](https://img.shields.io/badge/MADE_FOR-0G_APAC_HACKATHON_2026-0038FF?style=for-the-badge&labelColor=D4FF00)

<sub>**SKILLMINT PROTOCOL · VERIFIED AI SKILL EXECUTION**</sub>

</div>
