# SkillMint Reviewer Guide

SkillMint is a verified execution and monetization layer for AI agent skills on 0G.

Primary hackathon track: Track 3, Agentic Economy & Autonomous Applications.
Secondary alignment: Track 1, Agentic Infrastructure, through verifiable agent skills, 0G Storage, and 0G Compute.

## Review Links

- Live app: https://skillmint-0g.vercel.app
- Explainer: https://skillmint-0g.vercel.app/explainer
- Demo video: https://www.youtube.com/watch?v=CE35T3lOz4Q
- SMP-1 draft: `SMP-1-SkillMint-Verified-Skill-Standard.md`

## Canonical Demo Flow

1. Creator publishes a skill.
2. Skill prompt or bundle is encrypted and stored through 0G Storage.
3. Skill is minted as an ERC-721 with ownership and dual pricing.
4. User or agent executes the skill with 0G, W0G, or USDC.E.
5. Oracle routes execution through 0G Compute and stores the receipt on 0G Storage.
6. Escrow settles revenue to the skill owner and protocol treasury.
7. Anyone can verify the receipt root and output integrity.

## Mainnet Contracts

Network: 0G Aristotle Mainnet, chainId `16661`

| Component | Address |
|---|---|
| SkillRegistryV3 | `0xdF28e06899955092DF81f0DBea03496D1Ac8904E` |
| SkillEscrowV3 | `0xA0e5A7d722399f59A0Ee4B8DF740107FBC63f7ae` |
| DemoW0G | `0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01` |
| USDC.E | `0x1f3aa82227281ca364bfb3d253b0f1af1da6473e` |

## Useful Checks

```bash
cd shared
npm test
```

```bash
cd sdk
npm run build
```

```bash
node --check oracle/src/x402-server.js
```

## SDK Example

Build the SDK first, then run the tracked x402 agent example with your own funded private key:

```bash
cd sdk
npm run build
PRIVATE_KEY=0x... node examples/agent-run.mjs
```

The example discovers live skills, executes one through x402, prints the settlement transaction, fetches the 0G Storage receipt, and verifies the receipt.

## Notes

- No private keys or environment files are required for static review.
- Paid execution examples require a funded wallet.
- Current production paths use V3 contracts and shared config. Historical migration scripts are not the canonical review path.
