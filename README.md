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

**[▶ Live App](https://frontend-mauve-eta-12.vercel.app)** · **[📖 Explainer](https://frontend-mauve-eta-12.vercel.app/explainer)** · **[🔗 0G ChainScan](https://chainscan-galileo.0g.ai)** · **[📂 0G StorageScan](https://storagescan-galileo.0g.ai)**

</div>

---

## ![THE PROBLEM](https://img.shields.io/badge/⚡-THE_PROBLEM-0038FF?style=for-the-badge&labelColor=000000)

AI models are **black boxes**. When an agent calls an AI and gets back a result, there's no proof of *which* model ran, *what prompt* it was given, or whether the output was tampered with. In agentic systems where money moves on every hop, this is broken.

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

A **TEE** is a hardware-isolated enclave (Intel SGX / AMD SEV) on 0G Compute nodes. Code runs inside a locked glass box — nobody, not even the server operator, can peek in or modify what's happening. The TEE signs a **cryptographic attestation** proving the exact model + prompt + output, giving agents trustless provenance.

## ![WHY NFT](https://img.shields.io/badge/🛡-WHY_NFT-D4FF00?style=for-the-badge&labelColor=000000)

Every skill is an **ERC-721** with its prompt stored **encrypted** on 0G Storage. Buyers execute it but **never see the prompt** — they only see the output. Creators keep their IP secret while earning royalties forever. Transfer the NFT → revenue follows.

## ![ARCHITECTURE](https://img.shields.io/badge/🧱-ARCHITECTURE-0038FF?style=for-the-badge&labelColor=000000)

| Package            | What's Inside                                                          |
|--------------------|------------------------------------------------------------------------|
| **`contracts/`**   | `SkillRegistryV2` (ERC-721 + ERC-2981) · `SkillEscrowV2` (PullPayment) |
| **`oracle/`**      | Event watcher → 0G Compute TEE → receipt on 0G Storage → on-chain confirm |
| **`frontend/`**    | Next.js 16 · neo-brutalist UI · ethers.js · scroll-driven explainer    |
| **`sdk/`**         | TypeScript SDK — `publishSkill` · `executeSkill` · `verifyExecution`   |
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

## ![LIVE DEPLOYMENT](https://img.shields.io/badge/🌐-LIVE_DEPLOYMENT-D4FF00?style=for-the-badge&labelColor=000000)

| Component | Where |
|-----------|-------|
| **Frontend** | [`frontend-mauve-eta-12.vercel.app`](https://frontend-mauve-eta-12.vercel.app) · Vercel |
| **Oracle** | AWS EC2 · `ap-south-1` · systemd |
| **SkillRegistryV2** | `0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4` · [0G ChainScan](https://chainscan-galileo.0g.ai/address/0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4) |
| **SkillEscrowV2** | `0xe2841b105B695610f2c1194f8865474A536184dB` · [0G ChainScan](https://chainscan-galileo.0g.ai/address/0xe2841b105B695610f2c1194f8865474A536184dB) |
| **Network** | 0G Galileo Testnet · Chain ID `16602` |

## ![DESIGN](https://img.shields.io/badge/🎨-DESIGN-0038FF?style=for-the-badge&labelColor=000000)

Neo-brutalism. **Electric blue** `#0038FF` · **Acid lime** `#D4FF00` · **Parrot green** `#20C20E` · hard black 4px shadows · **Archivo Black** display type.

## ![LICENSE](https://img.shields.io/badge/📜-LICENSE-D4FF00?style=for-the-badge&labelColor=000000)

MIT — build freely.

<div align="center">
<br/>

![Hackathon](https://img.shields.io/badge/MADE_FOR-0G_APAC_HACKATHON_2026-0038FF?style=for-the-badge&labelColor=D4FF00)

<sub>**SKILLMINT PROTOCOL · VERIFIED AI SKILL EXECUTION**</sub>

</div>
