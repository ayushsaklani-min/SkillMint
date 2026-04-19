# SkillMint Trust Model

This document describes who must be trusted for each claim in the SkillMint protocol to hold, and what the post-hackathon hardening roadmap addresses.

## Current MVP (v1)

### What's cryptographically guaranteed

1. **On-chain escrow + settlement** — no trust in any oracle or backend. The escrow contract holds funds and releases the 90/10 split only when `confirmExecution` is called with a valid receipt root. This is enforced by the `SkillEscrowV2` contract on 0G Galileo.

2. **TEE attestation on inference** — `0G Compute` returns an attested chat ID that the oracle verifies via `broker.inference.processResponse()`. Outputs that fail this check trigger an automatic refund on-chain.

3. **Receipt immutability** — every execution receipt is uploaded to 0G Storage and its root is committed on-chain. Anyone can download the receipt by the committed root and recompute the hashes.

4. **Input integrity binding** — the agent commits `keccak256(input)` on-chain when paying. The oracle rejects any input whose hash doesn't match the committed value, and the mismatch triggers a refund.

5. **Prompt ciphertext on-chain/at-rest** — the skill NFT metadata references a 0G Storage root. The payload at that root is AES-256-GCM ciphertext. Block explorers, 0G Storage mirrors, and any third party observing the network see only ciphertext — never plaintext.

### What still requires trust in SkillMint

1. **Oracle holds the AES key** — the symmetric encryption key (`ORACLE_KEY`) lives in the oracle's environment. A compromised oracle host could decrypt all skill prompts. This matches the ClawHavoc threat model at one hop removed: the oracle is the single point we need to harden.

2. **Oracle sees plaintext input + prompt in memory** — decryption + inference call happen inside the oracle process. RAM on the oracle host could theoretically be dumped by a sufficiently privileged attacker.

3. **Oracle can't censor or rewrite outputs** (bounded) — because the TEE attestation round-trips the chatID back through `processResponse()`, an oracle that swaps the output gets rejected. But an oracle that fails to run an execution at all can be held accountable only via the 1-hour refund timeout.

## Post-hackathon hardening (v2)

The known gaps above are addressed by migrating the oracle into a **Nitro Enclave** (or equivalent attested compute). At that point:

- The AES key lives only inside the enclave; clients encrypt to an enclave-attested public key.
- Plaintext prompts + inputs exist only in enclave memory, never on the host.
- Every receipt carries two attestations: the enclave attestation + the 0G Compute TEE attestation.
- The `verify` page validates both attestations client-side against their respective root CAs + PCR allowlists.

See `28-DAY-PLAN.md` for the full hardening plan.

## Summary table

| Claim | Who you trust today | Who you trust post-v2 |
|---|---|---|
| Payments settle correctly | 0G consensus | 0G consensus |
| Receipts are immutable | 0G Storage | 0G Storage |
| Inputs weren't tampered | 0G consensus + oracle | 0G consensus + enclave attestation |
| Outputs weren't tampered | 0G Compute TEE | 0G Compute TEE + enclave attestation |
| Prompts stay secret | Oracle operator (SkillMint) | Enclave attestation (hardware) |
| Inputs stay secret from network | Oracle operator (SkillMint) | Enclave attestation (hardware) |
