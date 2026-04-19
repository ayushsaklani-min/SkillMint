# SkillMint — 28-Day Implementation Plan

**Goal:** Close the two gaps that weaken the README's core claims, so we don't need to reframe anything.

**Deadline:** 28 days from 2026-04-19 → target ship date **2026-05-17**

---

## Gaps to Close

### Gap 1 — Encrypted Prompts (README claim: "prompts stored encrypted on 0G Storage")
**Reality today:**
- `frontend/src/app/publish/page.tsx:63` — `metadata = JSON.stringify({ name, description, systemPrompt })` → plaintext prompt in on-chain metadata
- `sdk/src/client.ts:242` — same plaintext pattern
- `oracle/src/index.js:69` — already tries to download prompt from 0G Storage via `skill.promptHash`, but falls back to plaintext metadata because storage upload never happens

### Gap 2 — Real Input Passthrough (README claim: "TEE runs the skill")
**Reality today:**
- `frontend/src/app/execute/page.tsx:173` — only `inputHash` (not real input) is committed on-chain
- `oracle/src/index.js:95` — TEE gets `"Execute skill {skillId}. Input hash: {inputHash}"` as user message, never the actual input

---

## Architectural Decision — Double TEE

Since **0G Compute TEE is a black-box inference endpoint** (we don't ship custom code into it), plaintext decryption must happen in a trusted component *before* forwarding to inference. Options considered:

| Option | Verdict |
|---|---|
| Run custom TEE via Intel SGX directly | ❌ Too heavy for 28d |
| Use oracle with no TEE, document trust assumption | ❌ Weakens claim |
| **Oracle in AWS Nitro Enclave** (attested) | ✅ **Chosen** |

**Final trust model:**
1. **Nitro Enclave** (oracle) — handles decryption, enforces prompt/input binding, attested via AWS NSM
2. **0G Compute TEE** — runs inference, attested via 0G broker `processResponse()`

Receipt combines both attestations. User verifies: *"This specific enclave decrypted this specific ciphertext and handed plaintext to this specific 0G TEE."*

---

## Track A — Encryption Primitives & Storage (Days 1–6)

**A1. Crypto package** (`packages/crypto/`) — Day 1–2
- `encryptPrompt(prompt, enclavePubKey) → { ciphertext, wrappedKey, iv }` (AES-256-GCM + ECIES-P256)
- `encryptInput(input, enclavePubKey) → { ciphertext, wrappedKey, iv }`
- `decryptInEnclave(ciphertext, wrappedKey, iv, enclavePrivKey) → plaintext`
- Unit tests: round-trip, tamper detection, wrong-key rejection

**A2. 0G Storage helpers** (`packages/storage/`) — Day 3
- `uploadCiphertext(bytes) → storageRoot` (wrapper over `0g-ts-sdk`)
- `downloadCiphertext(storageRoot) → bytes`
- Integration test against Galileo storage indexer

**A3. Enclave attestation PKI** — Day 4–6
- Nitro Enclave generates P-256 keypair at boot, publishes pubkey + NSM attestation doc at `/enclave-key`
- Client library: fetch pubkey, verify attestation via AWS root CA + PCR allowlist
- Rotation policy: new key per enclave boot; old `skillId`s re-wrap on first execute (migration helper)

**Deliverable:** Any client can fetch a verified enclave public key and encrypt payloads to it.

---

## Track B — Nitro Enclave Oracle (Days 5–12, parallel with A)

**B1. Enclave-ify oracle** — Day 5–7
- Build image: `oracle/enclave/Dockerfile` + `nitro-cli build-enclave`
- Split oracle into two processes:
  - **Parent EC2:** watches `ExecutionRequested`, fetches ciphertexts from 0G Storage, forwards to enclave via vsock
  - **Enclave:** decrypts prompt + input, calls 0G Compute inference, verifies 0G TEE attestation, signs combined receipt, returns to parent
- Parent writes receipt to 0G Storage + calls `confirmExecution` on-chain

**B2. Vsock protocol** — Day 8–9
- Define messages: `DecryptAndInfer`, `HealthCheck`, `RotateKey`
- Enclave never exposes plaintext outside vsock boundary
- Parent never sees decryption key

**B3. Attestation endpoint** — Day 10
- Parent exposes `GET /attestation` → returns `{ enclavePubKey, attestationDoc, pcr0, pcr1, pcr2 }`
- Attestation doc is AWS NSM output, verifiable by clients

**B4. Deploy** — Day 11–12
- Replace current EC2 instance with `m5.xlarge` + enclave support
- Systemd units for parent + enclave lifecycle
- Health check + auto-restart

**Deliverable:** Oracle runs in attested Nitro Enclave. Plaintext prompts/inputs exist only inside enclave memory.

---

## Track C — Publish Flow Rewrite (Days 7–10)

**C1. Publish encryption flow** — Day 7–8
- `publish/page.tsx`:
  1. User fills prompt → click Publish
  2. Fetch `GET /attestation` from oracle, verify enclave attestation client-side
  3. Encrypt prompt with enclave pubkey → `{ ciphertext, wrappedKey, iv }`
  4. Upload ciphertext to 0G Storage → `storageRoot`
  5. Build metadata: `{ name, description, storageRoot, wrappedKey, iv, algo: "aes-256-gcm+ecies-p256" }` — **no plaintext prompt**
  6. Call `registerSkill(promptHash, computeProvider, model, priceWei, metadata)` where `promptHash = keccak256(ciphertext)`

**C2. SDK parity** — Day 9
- `sdk/src/client.ts` — `publishSkill()` accepts plaintext, does encryption + upload internally
- Add `publishSkillRaw()` for users who pre-encrypted (backdoor for programmatic flows)

**C3. Migration helper** — Day 10
- Script: `scripts/migrate-plaintext-skills.js`
- Iterates existing skills, detects plaintext metadata, re-publishes encrypted version as new `skillId`, marks old ones deprecated via `ERC-4906` metadata update event

**Deliverable:** Every newly-published skill has zero plaintext prompt anywhere on-chain or in storage.

---

## Track D — Execute Flow Rewrite (Days 11–16)

**D1. Contract upgrade** — Day 11–12
- Add `requestExecutionV2(skillId, inputHash, inputStorageRoot, wrappedInputKey, inputIv)` to `SkillEscrowV2` (or deploy `SkillEscrowV3`)
- Emit `ExecutionRequestedV2` event with all params
- Keep old function for backward compat; mark deprecated

**D2. Execute UI** — Day 13–14
- `execute/page.tsx`:
  1. User types input → click Execute
  2. Fetch enclave attestation + pubkey (cached from publish flow)
  3. Encrypt input → `{ ciphertext, wrappedKey, iv }`
  4. Upload ciphertext to 0G Storage → `inputStorageRoot`
  5. Call `requestExecutionV2(skillId, keccak256(ciphertext), inputStorageRoot, wrappedKey, iv)` with payment

**D3. Oracle event loop** — Day 15
- Subscribe to `ExecutionRequestedV2`
- Fetch prompt ciphertext (from skill.metadata.storageRoot) + input ciphertext (from event.inputStorageRoot)
- Forward both to enclave with their wrapped keys + IVs
- Enclave: decrypt both, call inference with `{ system: plaintextPrompt, user: plaintextInput }`, sign receipt

**D4. SDK parity** — Day 16
- `executeSkill()` takes `plaintextInput`, handles encryption + storage upload + tx
- `verifyExecution()` validates both enclave + 0G attestations

**Deliverable:** Real user input flows into the model via the enclave. No more "Input hash: X" placeholder.

---

## Track E — Receipt & Verification (Days 17–20)

**E1. Combined receipt schema** — Day 17
```json
{
  "executionId": "...",
  "skillId": 42,
  "inputHash": "0x...",
  "outputHash": "0x...",
  "enclaveAttestation": { "doc": "base64...", "pcr0": "...", "pubKey": "..." },
  "teeAttestation": { "chatID": "...", "providerAddr": "0x...", "verified": true },
  "timestamp": 1715000000,
  "outputCiphertext": "base64..."  // encrypted to agent's pubkey
}
```

**E2. On-chain commitment** — Day 18
- `confirmExecution` already takes receipt root; add separate method `confirmExecutionV2(executionId, receiptRoot, enclavePcr0, teeProviderAddr)` for stronger on-chain commitments

**E3. Verify page rewrite** — Day 19–20
- `verify/page.tsx`:
  - Input: executionId or receipt root
  - Downloads receipt from 0G Storage
  - Validates enclave attestation (AWS root CA + PCR allowlist check)
  - Validates 0G Compute attestation (via broker)
  - Validates hash chain: `inputHash` matches input ciphertext, `outputHash` matches decrypted output
  - Shows "VERIFIED ✓" with both attestation summaries

**Deliverable:** Any third party can independently verify an execution with zero trust in SkillMint.

---

## Track F — Integration, Hardening, Ship (Days 21–28)

**F1. End-to-end test suite** — Day 21–22
- Publish encrypted skill → execute with encrypted input → verify receipt
- Malicious input test: tamper ciphertext → enclave rejects
- Malicious enclave test: wrong PCR → client rejects attestation
- Downtime test: enclave restart mid-execution → retry logic

**F2. Security review** — Day 23–24
- IV uniqueness audit (never reuse across encryptions)
- Key rotation under load
- Timing attack surface on decryption path
- External review: post to 0G Discord + security-focused followers

**F3. Contract deploy + verify** — Day 25
- Deploy `SkillEscrowV3` (or upgraded V2) to Galileo
- Verify on 0G ChainScan
- Update `shared/config.js` with new addresses
- Update ABIs in `shared/abis/`

**F4. Documentation** — Day 26
- Update README: remove any "MVP" caveats; claims now match reality
- Update explainer Scene 03 (Publish) to show encryption step
- Update explainer Scene 05 (Execute) to show input encryption
- Add security doc: `docs/SECURITY.md` — threat model, trust assumptions, attestation chain

**F5. Frontend deploy** — Day 27
- Vercel deploy with new oracle attestation endpoint
- Test against live enclave
- Smoke test: publish + execute + verify on live site

**F6. Launch** — Day 28
- Announce: ClawHavoc framing now fully substantiated
- Tweet thread: "We said prompts are encrypted. Now they actually are."
- GitHub release `v2.0-verified`

---

## Critical Dependencies & Risk Log

| Risk | Mitigation |
|---|---|
| AWS Nitro Enclave Node.js runtime limitations (some crypto libs don't work) | Prototype enclave on Day 5; validate `@noble/curves` + `node:crypto` work before committing |
| 0G Storage upload latency blows execution UX | Measure Day 3; if >5s, add progress UI; parallel upload during tx pending |
| 0G Compute broker API changes mid-build | Pin `@0glabs/0g-serving-broker` version; track their changelog |
| Contract upgrade complexity (UUPS vs new deploy) | Go with new `V3` deploy — simpler, old skills remain executable |
| Attestation verification library on browser | Port AWS nitro-attestation-verify to WASM OR use lightweight custom verifier (cert chain + COSE sign) |
| User wallet signing UX for encrypted payloads | Use EIP-712 structured data for readability |

---

## Parallelization Map

```
Day:  1   5   10   15   20   25   28
A:    ██████░░░░░                        (Days 1-6)
B:        ████████░░░░                   (Days 5-12, depends on A3)
C:            ██████░░                   (Days 7-10, depends on A1-A2)
D:                ██████░░               (Days 11-16, depends on B + C)
E:                    ████████░          (Days 17-20, depends on D)
F:                          ████████     (Days 21-28)
```

A + first half of B run in parallel. C kicks off as soon as A completes. D waits for B1-B3 + C. E and F are sequential after D.

---

## Definition of Done (Day 28)

- [ ] `publish/page.tsx` never sends plaintext prompt anywhere
- [ ] `execute/page.tsx` never sends plaintext input anywhere
- [ ] Oracle plaintext exposure is only inside Nitro Enclave memory
- [ ] Every receipt has two attestations (Nitro + 0G Compute)
- [ ] `verify/page.tsx` validates both attestations client-side
- [ ] README claims all match code reality — no reframing needed
- [ ] End-to-end test passes on live Galileo testnet
- [ ] Migration script handles existing plaintext skills
- [ ] SDK v2.0 published with encrypted-by-default flows
- [ ] Explainer scenes updated to reflect new flow

---

## Acceptance Test (proof it's real)

A skeptical judge runs this and gets the expected result:

```bash
# 1. Publish a skill with a secret prompt
$ skillmint publish --prompt "SECRET SAUCE"

# 2. Query on-chain metadata
$ cast call $REGISTRY "getSkill(uint256)" 99
# Output: metadata contains storageRoot + wrappedKey — NO PLAINTEXT

# 3. Download ciphertext from 0G Storage
$ 0g-storage download $STORAGE_ROOT prompt.bin
$ xxd prompt.bin
# Output: random bytes — NOT "SECRET SAUCE"

# 4. Execute with test input
$ skillmint execute --skill 99 --input "USER QUERY"

# 5. Verify receipt
$ skillmint verify $EXECUTION_ID
# Output:
#   ✓ Nitro Enclave attestation valid (PCR0 matches allowlist)
#   ✓ 0G Compute TEE attestation valid (chatID verified)
#   ✓ Input hash chain valid
#   ✓ Output hash chain valid
#   VERIFIED — execution is provable end-to-end
```

When this passes, the README is true.
