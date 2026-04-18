<div align="center">

<img src="frontend/public/logo.png.png" alt="SkillMint" width="180"/>

# **SKILL**<span>MINT</span>

### **The verified AI skill execution protocol.**

*Every execution TEE-attested. Every payment automatic. Every result provable.*

<br/>

![Built on 0G](https://img.shields.io/badge/BUILT_ON-0G_GALILEO-0038FF?style=for-the-badge&labelColor=000000)
![TEE Verified](https://img.shields.io/badge/TEE-ATTESTED-D4FF00?style=for-the-badge&labelColor=000000)
![Hackathon](https://img.shields.io/badge/0G_APAC-HACKATHON_2026-0038FF?style=for-the-badge&labelColor=000000)
![Status](https://img.shields.io/badge/STATUS-LIVE-D4FF00?style=for-the-badge&labelColor=000000)

<br/>

**[▶ Live App](https://frontend-mauve-eta-12.vercel.app)** · **[📖 Explainer](https://frontend-mauve-eta-12.vercel.app/explainer)** · **[🔗 0G ChainScan](https://chainscan-galileo.0g.ai)**

</div>

---

## ⚡ What is SkillMint?

**AI outputs you can prove.** SkillMint turns AI system prompts into tradeable **ERC-721 NFTs**, and wraps every execution in a **TEE (Trusted Execution Environment)** so the output ships with a cryptographic receipt that's impossible to fake.

```
Agent pays ──▶ TEE runs skill ──▶ Verified output + attestation ──▶ Receipt on 0G Storage
                                          │
                                          └──▶ 90% to NFT owner, 10% protocol
```

## 🧱 What's Inside

| Package          | Purpose                                                    |
|------------------|------------------------------------------------------------|
| **`contracts/`** | `SkillRegistryV2` (NFT) · `SkillEscrowV2` (PullPayment)    |
| **`oracle/`**    | Node.js watcher → 0G Compute TEE → on-chain confirm        |
| **`frontend/`**  | Next.js 16 · neo-brutalist UI · ethers.js · wallet connect |
| **`sdk/`**       | TypeScript SDK for agents to call skills                   |
| **`skills/`**    | Seed skill registry + publish scripts                      |
| **`shared/`**    | ABIs + network config                                      |

## 🚀 Quick Start

```bash
# Frontend
cd frontend && npm install --legacy-peer-deps && npm run dev

# Oracle
cd oracle && npm install && cp .env.example .env && npm start

# Contracts
cd contracts && npm install && npx hardhat test
```

## 🎨 Design

**Neo-brutalism** · Electric blue `#0038FF` · Acid lime `#D4FF00` · Hard black shadows · Archivo Black display type.

## 📜 License

MIT — build freely.

<div align="center">
<br/>

**Made for the 0G APAC Hackathon 2026** 🌏

<sub>`SKILLMINT PROTOCOL · VERIFIED AI SKILL EXECUTION`</sub>

</div>
