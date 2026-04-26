import { ethers } from "ethers";
import { REGISTRY_ABI, ESCROW_ABI, W0G_ABI } from "./abis.js";
import { TESTNET, MAINNET } from "./constants.js";
import type {
  NetworkConfig,
  Skill,
  SkillMetadata,
  SkillMintOptions,
  Execution,
  ExecutionRequest,
  ExecutionResult,
  ExecutionOutcome,
  Reputation,
  RevenueInfo,
  PaymentPayload,
  PaymentRequirements,
  EIP3009Authorization,
  X402ExecuteResult,
  SkillReceipt,
  ReceiptVerification,
  AgentSkillMetadata,
  RegisterAgentSkillResult,
  DownloadAgentSkillResult,
  AgentSkillReceipt,
  AgentSkillReceiptVerification,
} from "./types.js";
import { AGENT_SKILL_PROVIDER, AGENT_SKILL_MODEL } from "./types.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Wrap fetch with context. Turns `fetch failed` into something actionable. */
async function httpJson<T>(label: string, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error(`${label}: network error reaching ${url} — ${(e as Error).message}. If the default is unreachable, pass a custom url to SkillMintClient().`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} from ${url} — ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}: non-JSON response from ${url} — ${text.slice(0, 200)}`);
  }
}

/** Run async fn over items with bounded concurrency. */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export class SkillMintClient {
  readonly provider: ethers.JsonRpcProvider;
  readonly wallet: ethers.Wallet;
  readonly registry: ethers.Contract;
  readonly escrow: ethers.Contract;
  readonly w0g: ethers.Contract;
  readonly network: NetworkConfig;
  readonly oracleUrl: string;
  readonly x402Url: string;

  constructor(options: SkillMintOptions) {
    // Resolve network config
    if (typeof options.network === "object") {
      this.network = options.network;
    } else if (options.network === "mainnet") {
      this.network = MAINNET;
    } else {
      this.network = TESTNET;
    }

    const rpcUrl = options.rpcUrl || this.network.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(options.privateKey, this.provider);
    this.registry = new ethers.Contract(this.network.registry, REGISTRY_ABI, this.wallet);
    this.escrow = new ethers.Contract(this.network.escrow, ESCROW_ABI, this.wallet);
    this.w0g = new ethers.Contract(this.network.w0g, W0G_ABI, this.wallet);
    this.oracleUrl = (options.oracleUrl || this.network.oracleUrl).replace(/\/$/, "");
    this.x402Url = (options.x402Url || this.network.x402Url).replace(/\/$/, "");
  }

  /** Wallet address of the SDK user */
  get address(): string {
    return this.wallet.address;
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  /** Get total number of skills on-chain */
  async getSkillCount(): Promise<number> {
    return Number(await this.registry.skillCount());
  }

  /** Get a single skill by ID with full details */
  async getSkill(skillId: number): Promise<Skill> {
    const [raw, owner, rep] = await Promise.all([
      this.registry.getSkill(skillId),
      this.registry.ownerOf(skillId) as Promise<string>,
      this.registry.getReputationScore(skillId),
    ]);

    return this._parseSkill(skillId, raw, owner, rep);
  }

  /**
   * List all skills on-chain with bounded RPC concurrency. Public Galileo
   * RPCs rate-limit Promise.all over a full registry, so we cap at 3.
   */
  async listSkills(opts: { concurrency?: number } = {}): Promise<Skill[]> {
    const count = await this.getSkillCount();
    if (count === 0) return [];
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    return mapConcurrent(ids, opts.concurrency ?? 3, (id) => this.getSkill(id));
  }

  /**
   * Resolve a skill from a user-friendly identifier:
   *   - numeric id (or numeric string)
   *   - promptHash (keccak256 of the encrypted-prompt body — length 66)
   *   - storageRoot (same length, distinct value)
   *   - metadata.name (case-insensitive substring match)
   *
   * Returns the first Skill that matches, or null. Useful when agents are
   * handed a hash from a published.json log and expect it to "just work".
   */
  async resolveSkill(identifier: string | number): Promise<Skill | null> {
    if (typeof identifier === "number") return this.getSkill(identifier).catch(() => null);
    if (/^\d+$/.test(identifier)) return this.getSkill(Number(identifier)).catch(() => null);

    const all = await this.listSkills();
    const id = identifier.toLowerCase();
    if (id.startsWith("0x") && id.length === 66) {
      return (
        all.find((s) => s.promptHash.toLowerCase() === id) ||
        all.find((s) => (s.metadata.storageRoot || "").toLowerCase() === id) ||
        null
      );
    }
    return all.find((s) => (s.metadata.name || "").toLowerCase().includes(id)) || null;
  }

  /** Search skills by name or description (case-insensitive) */
  async searchSkills(query: string): Promise<Skill[]> {
    const all = await this.listSkills();
    const q = query.toLowerCase();
    return all.filter(
      (s) =>
        (s.metadata.name?.toLowerCase().includes(q) ?? false) ||
        (s.metadata.description?.toLowerCase().includes(q) ?? false) ||
        s.model.toLowerCase().includes(q)
    );
  }

  /** Get all skill IDs created by a specific developer */
  async getDeveloperSkills(developer: string): Promise<number[]> {
    const ids: bigint[] = await this.registry.getDeveloperSkills(developer);
    return ids.map(Number);
  }

  /** Get reputation score for a skill */
  async getReputation(skillId: number): Promise<Reputation> {
    const [total, successful, successRate] = await this.registry.getReputationScore(skillId);
    return {
      total: Number(total),
      successful: Number(successful),
      successRate: Number(successRate),
    };
  }

  // ─── Execution ──────────────────────────────────────────────────────────────

  /**
   * Execute a skill: sends payment to escrow and returns execution details.
   * The oracle picks up the event and processes the skill in TEE hardware.
   *
   * @param skillId - The skill NFT token ID
   * @param input - Raw input string (will be hashed)
   * @returns ExecutionRequest with executionId and txHash
   */
  async execute(skillId: number, input: string): Promise<ExecutionRequest> {
    const skill = await this.registry.getSkill(skillId);
    if (!skill.active) {
      throw new Error(`Skill #${skillId} is not active`);
    }

    const inputHash = ethers.keccak256(ethers.toUtf8Bytes(input));
    const price = skill.priceA0GI;

    const tx = await this.escrow.requestExecution(skillId, inputHash, {
      value: price,
    });
    const receipt = await tx.wait();

    // Parse ExecutionRequested event from receipt
    const event = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return this.escrow.interface.parseLog({ topics: log.topics as string[], data: log.data });
        } catch {
          return null;
        }
      })
      .find((e: ethers.LogDescription | null) => e?.name === "ExecutionRequested");

    if (!event) {
      throw new Error("ExecutionRequested event not found in transaction receipt");
    }

    const executionId = event.args[0] as string;

    // Hand the real input off to the oracle so the TEE can actually run the skill.
    await httpJson<{ ok: true }>("oracle /input", `${this.oracleUrl}/input`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ executionId, input }),
    });

    return {
      executionId,
      skillId: Number(event.args[1]),
      txHash: tx.hash,
      amount: ethers.formatEther(event.args[4]),
    };
  }

  /**
   * Execute a skill and wait for the oracle to confirm it.
   * Returns the full execution result including receipt hash.
   *
   * @param skillId - The skill NFT token ID
   * @param input - Raw input string
   * @param timeoutMs - Max time to wait for confirmation (default: 120s)
   */
  async executeAndWait(
    skillId: number,
    input: string,
    timeoutMs: number = 120_000
  ): Promise<ExecutionResult> {
    const request = await this.execute(skillId, input);

    return new Promise<ExecutionResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.escrow.off("ExecutionConfirmed");
        reject(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Listen for confirmation event matching our executionId
      const filter = this.escrow.filters.ExecutionConfirmed(request.executionId);
      this.escrow.once(filter, (executionId: string, receiptHash: string, payee: string, payeeAmount: bigint, treasuryAmount: bigint) => {
        clearTimeout(timeout);
        resolve({
          executionId,
          skillId,
          txHash: request.txHash,
          receiptHash,
          payee,
          payeeAmount: ethers.formatEther(payeeAmount),
          treasuryAmount: ethers.formatEther(treasuryAmount),
        });
      });
    });
  }

  /**
   * One-shot "what happened with this execution?" — merges on-chain state,
   * the ExecutionConfirmed event, and the stored receipt body. Lets agents
   * go executionId → output in a single call.
   */
  async getExecutionOutcome(executionId: string): Promise<ExecutionOutcome> {
    const exec = await this.getExecution(executionId);
    const base: ExecutionOutcome = {
      executionId,
      skillId: exec.skillId,
      settled: exec.settled,
      refunded: exec.refunded,
      receiptHash: null,
      payee: null,
      payeeAmount: null,
      treasuryAmount: null,
      receipt: null,
    };
    if (!exec.settled) return base;

    // Pull the ExecutionConfirmed event for this executionId — scan a
    // reasonable window so newly-confirmed executions resolve quickly.
    const head = await this.provider.getBlockNumber();
    const from = Math.max(0, head - 5000);
    const events = await this.escrow.queryFilter(
      this.escrow.filters.ExecutionConfirmed(executionId),
      from,
      head
    );
    if (events.length === 0) return base;

    const args = (events[events.length - 1] as ethers.EventLog).args;
    const receiptHash: string = String(args[1]);
    const payee: string = String(args[2]);
    const payeeAmount: bigint = args[3] as bigint;
    const treasuryAmount: bigint = args[4] as bigint;

    let receipt: SkillReceipt | null = null;
    try {
      receipt = await this.fetchReceipt(receiptHash);
    } catch {
      // Storage fetch is best-effort — the on-chain hash is the source of truth.
    }
    return {
      ...base,
      receiptHash,
      payee,
      payeeAmount: ethers.formatEther(payeeAmount),
      treasuryAmount: ethers.formatEther(treasuryAmount),
      receipt,
    };
  }

  /** Get execution details by ID */
  async getExecution(executionId: string): Promise<Execution> {
    const raw = await this.escrow.getExecution(executionId);
    return {
      executionId: raw.executionId,
      skillId: Number(raw.skillId),
      agent: raw.agent,
      inputHash: raw.inputHash,
      amount: ethers.formatEther(raw.amount),
      amountWei: raw.amount,
      payeeAtFunding: raw.payeeAtFunding,
      createdAt: new Date(Number(raw.createdAt) * 1000),
      settled: raw.settled,
      refunded: raw.refunded,
    };
  }

  /** Request a refund for a timed-out execution */
  async refund(executionId: string): Promise<string> {
    const tx = await this.escrow.refund(executionId);
    await tx.wait();
    return tx.hash;
  }

  // ─── Skill Publishing ───────────────────────────────────────────────────────

  /**
   * Register (mint) a new skill NFT.
   * The caller receives the NFT and earns revenue from every execution.
   *
   * @param params.systemPrompt - The AI system prompt
   * @param params.name - Human-readable skill name
   * @param params.description - What the skill does
   * @param params.computeProvider - 0G Compute provider address
   * @param params.model - Model identifier (e.g. "qwen/qwen-2.5-7b-instruct")
   * @param params.price - Price per execution in A0GI (e.g. "0.001")
   * @param params.inputSchema - Optional JSON schema for input
   * @param params.outputSchema - Optional JSON schema for output
   */
  async registerSkill(params: {
    systemPrompt: string;
    name: string;
    description: string;
    computeProvider: string;
    model: string;
    price: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }): Promise<{ skillId: number; txHash: string; owner: string }> {
    // Encrypt the prompt via the oracle before it touches on-chain metadata.
    const enc = await httpJson<{ storageRoot?: string; iv?: string; algo?: string; keyId?: string }>(
      "oracle /encrypt-prompt",
      `${this.oracleUrl}/encrypt-prompt`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemPrompt: params.systemPrompt }) }
    );
    if (!enc.storageRoot || !enc.iv) {
      throw new Error("Oracle returned malformed encryption payload");
    }

    const promptHash = ethers.keccak256(ethers.toUtf8Bytes(params.systemPrompt));
    const priceWei = ethers.parseEther(params.price);
    const metadata = JSON.stringify({
      name: params.name,
      description: params.description,
      storageRoot: enc.storageRoot,
      iv: enc.iv,
      algo: enc.algo,
      keyId: enc.keyId,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
    });

    const tx = await this.registry.registerSkill(
      promptHash,
      params.computeProvider,
      params.model,
      priceWei,
      metadata
    );
    await tx.wait();

    const skillId = Number(await this.registry.skillCount());
    return { skillId, txHash: tx.hash, owner: this.wallet.address };
  }

  // ─── NFT Owner Actions ─────────────────────────────────────────────────────

  /** Update the price of a skill you own */
  async updatePrice(skillId: number, newPrice: string): Promise<string> {
    const tx = await this.registry.updatePrice(skillId, ethers.parseEther(newPrice));
    await tx.wait();
    return tx.hash;
  }

  /** Deactivate a skill you own (stops new executions) */
  async deactivateSkill(skillId: number): Promise<string> {
    const tx = await this.registry.deactivateSkill(skillId);
    await tx.wait();
    return tx.hash;
  }

  /** Activate a skill you own (resumes executions) */
  async activateSkill(skillId: number): Promise<string> {
    const tx = await this.registry.activateSkill(skillId);
    await tx.wait();
    return tx.hash;
  }

  /** Transfer a skill NFT to another address */
  async transferSkill(skillId: number, to: string): Promise<string> {
    const tx = await this.registry.transferFrom(this.wallet.address, to, skillId);
    await tx.wait();
    return tx.hash;
  }

  // ─── Revenue ────────────────────────────────────────────────────────────────

  /** Check pending revenue for an address (defaults to wallet address) */
  async getPendingRevenue(address?: string): Promise<RevenueInfo> {
    const addr = address || this.wallet.address;
    const pendingWei: bigint = await this.escrow.payments(addr);
    return {
      pending: ethers.formatEther(pendingWei),
      pendingWei,
    };
  }

  /** Withdraw all pending revenue to your wallet */
  async withdrawRevenue(): Promise<string> {
    const tx = await this.escrow.withdrawPayments(this.wallet.address);
    await tx.wait();
    return tx.hash;
  }

  // ─── Wallet Info ────────────────────────────────────────────────────────────

  /** Get wallet balance in A0GI */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /** Get number of skill NFTs owned by an address */
  async getOwnedSkillCount(address?: string): Promise<number> {
    const addr = address || this.wallet.address;
    return Number(await this.registry.balanceOf(addr));
  }

  // ─── W0G (wrap / unwrap / balance) ─────────────────────────────────────────

  /** W0G balance of an address (defaults to the SDK wallet), formatted. */
  async getW0GBalance(address?: string): Promise<string> {
    const addr = address || this.wallet.address;
    const bal: bigint = await this.w0g.balanceOf(addr);
    return ethers.formatEther(bal);
  }

  /** Wrap native A0GI → W0G. Amount is a human-readable string like "0.001". */
  async wrapW0G(amount: string): Promise<string> {
    const tx = await this.w0g.deposit({ value: ethers.parseEther(amount) });
    await tx.wait();
    return tx.hash;
  }

  /** Unwrap W0G → native A0GI. Amount is a human-readable string. */
  async unwrapW0G(amount: string): Promise<string> {
    const tx = await this.w0g.withdraw(ethers.parseEther(amount));
    await tx.wait();
    return tx.hash;
  }

  // ─── x402 (pay-with-W0G HTTP skill endpoints) ──────────────────────────────

  /**
   * Sign an EIP-3009 transferWithAuthorization — the primitive x402 uses
   * to pay a skill endpoint gaslessly for the user. Returns an x402 v1
   * PaymentPayload ready for the X-PAYMENT header.
   */
  async signPaymentAuthorization(requirements: PaymentRequirements, opts?: { validBeforeSeconds?: number }): Promise<PaymentPayload> {
    const asset = requirements.asset;
    const assetName = requirements.extra?.name || "Wrapped 0G";
    const assetVersion = requirements.extra?.version || "1";
    const now = Math.floor(Date.now() / 1000);
    const validBefore = now + (opts?.validBeforeSeconds ?? 600);
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    const authorization: EIP3009Authorization = {
      from: this.wallet.address,
      to: requirements.payTo,
      value: requirements.maxAmountRequired,
      validAfter: "0",
      validBefore: String(validBefore),
      nonce,
    };

    const domain = {
      name: assetName,
      version: assetVersion,
      chainId: BigInt(this.network.chainId),
      verifyingContract: asset,
    };
    const types = {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    };
    const signature = await this.wallet.signTypedData(domain, types, {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    });

    return {
      x402Version: 1,
      scheme: "exact",
      network: requirements.network,
      payload: { signature, authorization },
    };
  }

  /**
   * Execute a skill via an x402-payable HTTP endpoint.
   *
   * Handles the full agent flow: probes for 402, ensures enough W0G,
   * signs an EIP-3009 authorization, retries with X-PAYMENT, and returns
   * the skill output + receipt root hash.
   *
   * @param x402Url   Base URL of the x402 skill server (e.g. https://x402.skillmint.xyz)
   * @param skillId   Skill ID to run
   * @param input     Raw input string for the skill
   * @param opts.autoWrap  If true (default), automatically wrap native A0GI
   *                        to cover any W0G shortfall.
   */
  async executeX402(
    skillIdOrUrl: number | string,
    skillIdOrInput: number | string,
    input?: string,
    opts: { autoWrap?: boolean } = {}
  ): Promise<X402ExecuteResult> {
    // Back-compat: older signature was executeX402(url, skillId, input).
    // New preferred signature is executeX402(skillId, input) which uses the
    // client's default x402Url.
    let base: string;
    let skillId: number;
    let realInput: string;
    if (typeof skillIdOrUrl === "string" && typeof skillIdOrInput === "number") {
      base = skillIdOrUrl.replace(/\/$/, "");
      skillId = skillIdOrInput;
      realInput = String(input ?? "");
    } else {
      base = this.x402Url;
      skillId = Number(skillIdOrUrl);
      realInput = String(skillIdOrInput ?? "");
    }
    const autoWrap = opts.autoWrap !== false;

    // 0. Up-front kind guard — refuse to inference-call an agent-skill rather
    //    than confusingly fail downstream when the response is application/zip.
    try {
      const skill = await this.registry.getSkill(skillId);
      const meta = JSON.parse(String(skill.metadata || "{}"));
      if (meta.kind === "agent-skill") {
        throw new Error(`skill #${skillId} is an agent-skill — call downloadAgentSkill() instead of executeX402()`);
      }
    } catch (e) {
      // Re-throw the kind error; swallow other read-skill failures so the
      // existing probe path still produces a useful network-level error.
      if ((e as Error).message?.includes("agent-skill")) throw e;
    }

    // 1. Probe — expect 402 with paymentRequirements
    const probeUrl = `${base}/skill/${skillId}/execute`;
    let probe: Response;
    try {
      probe = await fetch(probeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: realInput }),
      });
    } catch (e) {
      throw new Error(`x402 probe: network error reaching ${probeUrl} — ${(e as Error).message}. Pass {x402Url} to SkillMintClient() to override the default.`);
    }
    if (probe.status !== 402) {
      throw new Error(`x402 probe: expected 402, got ${probe.status} ${await probe.text()}`);
    }
    const challenge = (await probe.json()) as { accepts?: PaymentRequirements[] };
    const requirements = challenge.accepts?.[0];
    if (!requirements) throw new Error("x402 probe: no paymentRequirements in 402 body");
    if (requirements.asset.toLowerCase() !== this.network.w0g.toLowerCase()) {
      throw new Error(`x402 probe: asset ${requirements.asset} != SDK W0G ${this.network.w0g}`);
    }

    // 2. Ensure sufficient W0G
    const need = BigInt(requirements.maxAmountRequired);
    const bal: bigint = await this.w0g.balanceOf(this.wallet.address);
    if (bal < need) {
      if (!autoWrap) {
        throw new Error(`insufficient W0G: have ${ethers.formatEther(bal)}, need ${ethers.formatEther(need)} (pass autoWrap:true or call wrapW0G())`);
      }
      const short = need - bal + ethers.parseEther("0.0005"); // small buffer
      await this.wrapW0G(ethers.formatEther(short));
    }

    // 3. Sign + retry
    const paymentPayload = await this.signPaymentAuthorization(requirements);
    const header = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");
    const r = await fetch(`${base}/skill/${skillId}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment": header },
      body: JSON.stringify({ input: realInput }),
    });
    const body = (await r.json().catch(() => ({}))) as {
      skillId?: number;
      output?: string;
      receiptRootHash?: string;
      settlement?: { transaction: string; network: string; payer: string; blockNumber?: number };
    };
    if (r.status !== 200) {
      throw new Error(`x402 execute: ${r.status} ${JSON.stringify(body)}`);
    }

    return {
      skillId: Number(body.skillId ?? skillId),
      output: body.output ?? "",
      receiptRootHash: body.receiptRootHash ?? "",
      settlement: body.settlement ?? { transaction: "", network: requirements.network, payer: this.wallet.address },
      payer: body.settlement?.payer ?? this.wallet.address,
      paidW0G: ethers.formatEther(need),
    };
  }

  // ─── Agent skills (folder-bundle x402 flow) ────────────────────────────────

  /**
   * Publish an agent-skill: a Claude/Codex-style folder bundle (`.skill` zip)
   * sold per-download. Encrypts the bundle through the oracle, anchors a
   * sha256 commitment + storage root in the on-chain skill metadata.
   *
   * @param params.bundle  Bundle bytes — Buffer/Uint8Array, or filesystem path string.
   * @param params.price   W0G charged per download.
   */
  async registerAgentSkill(params: {
    bundle: Buffer | Uint8Array | string;
    name: string;
    description: string;
    price: string;
    format?: "claude-skill";
    compatibleWith?: string[];
  }): Promise<RegisterAgentSkillResult> {
    // Materialise the bundle bytes.
    const bytes: Buffer = typeof params.bundle === "string"
      ? readFileSync(params.bundle)
      : Buffer.isBuffer(params.bundle) ? params.bundle : Buffer.from(params.bundle);

    // Multipart upload to the oracle. The oracle validates, encrypts, uploads
    // ciphertext to 0G Storage, and returns the integrity commitments.
    const form = new FormData();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
    form.append("bundle", blob, `${params.name}.skill`);
    form.append("name", params.name);

    const url = `${this.oracleUrl}/encrypt-bundle`;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch (e) {
      throw new Error(`registerAgentSkill: network error reaching ${url} — ${(e as Error).message}. Pass {oracleUrl} to SkillMintClient() to override the default.`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`registerAgentSkill: oracle responded ${res.status} — ${body.slice(0, 400)}`);
    }
    const enc = (await res.json()) as {
      storageRoot: string; iv: string; algo: "aes-256-gcm"; keyId: string;
      sha256: string; manifest: string[]; sizeBytes: number;
    };

    // Build on-chain metadata.
    const metadata: AgentSkillMetadata = {
      kind: "agent-skill",
      name: params.name,
      description: params.description,
      bundleStorageRoot: enc.storageRoot,
      bundleIv: enc.iv,
      bundleAlgo: enc.algo,
      keyId: enc.keyId,
      bundleSha256: enc.sha256,
      sizeBytes: enc.sizeBytes,
      manifest: enc.manifest,
      ...(params.format ? { format: params.format } : {}),
      ...(params.compatibleWith ? { compatibleWith: params.compatibleWith } : {}),
    };

    // Mint the NFT. promptHash = bundleSha256 (it IS the cryptographic
    // commitment to the prompt-equivalent for this skill kind).
    const tx = await this.registry.registerSkill(
      enc.sha256,
      AGENT_SKILL_PROVIDER,
      AGENT_SKILL_MODEL,
      ethers.parseEther(params.price),
      JSON.stringify(metadata)
    );
    await tx.wait();
    const skillId = Number(await this.registry.skillCount());
    return {
      skillId,
      txHash: tx.hash,
      bundleStorageRoot: enc.storageRoot,
      bundleSha256: enc.sha256,
    };
  }

  /**
   * Buy + download an agent-skill. Pays via x402 (W0G), recomputes sha256
   * locally to detect any tampering, optionally extracts the zip to disk.
   */
  async downloadAgentSkill(
    skillIdOrName: number | string,
    opts: { autoWrap?: boolean; extractTo?: string } = {}
  ): Promise<DownloadAgentSkillResult> {
    // Resolve to a numeric id.
    let skillId: number;
    if (typeof skillIdOrName === "number") {
      skillId = skillIdOrName;
    } else if (/^\d+$/.test(skillIdOrName)) {
      skillId = Number(skillIdOrName);
    } else {
      const resolved = await this.resolveSkill(skillIdOrName);
      if (!resolved) throw new Error(`downloadAgentSkill: no skill matched "${skillIdOrName}"`);
      skillId = resolved.id;
    }
    const autoWrap = opts.autoWrap !== false;
    const base = this.x402Url;

    // 1. Probe → 402 with payment requirements.
    const probeUrl = `${base}/skill/${skillId}/execute`;
    let probe: Response;
    try {
      probe = await fetch(probeUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch (e) {
      throw new Error(`downloadAgentSkill probe: network error reaching ${probeUrl} — ${(e as Error).message}.`);
    }
    if (probe.status !== 402) {
      throw new Error(`downloadAgentSkill: expected 402 on probe, got ${probe.status} ${await probe.text()}`);
    }
    const challenge = (await probe.json()) as { accepts?: PaymentRequirements[] };
    const requirements = challenge.accepts?.[0];
    if (!requirements) throw new Error("downloadAgentSkill: no paymentRequirements in 402 body");
    if (requirements.asset.toLowerCase() !== this.network.w0g.toLowerCase()) {
      throw new Error(`downloadAgentSkill: asset ${requirements.asset} != SDK W0G ${this.network.w0g}`);
    }

    // 2. Ensure W0G balance.
    const need = BigInt(requirements.maxAmountRequired);
    const bal: bigint = await this.w0g.balanceOf(this.wallet.address);
    if (bal < need) {
      if (!autoWrap) {
        throw new Error(`insufficient W0G: have ${ethers.formatEther(bal)}, need ${ethers.formatEther(need)} (pass autoWrap:true or call wrapW0G())`);
      }
      const short = need - bal + ethers.parseEther("0.0005");
      await this.wrapW0G(ethers.formatEther(short));
    }

    // 3. Sign + retry. Response is application/zip + integrity headers.
    const paymentPayload = await this.signPaymentAuthorization(requirements);
    const header = Buffer.from(JSON.stringify(paymentPayload), "utf8").toString("base64");
    const r = await fetch(`${base}/skill/${skillId}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment": header },
      body: "{}",
    });
    if (r.status !== 200) {
      let body = "";
      try { body = await r.text(); } catch { /* ignore */ }
      throw new Error(`downloadAgentSkill: ${r.status} ${body.slice(0, 400)}`);
    }
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/zip")) {
      throw new Error(`downloadAgentSkill: unexpected content-type "${ct}" — server returned a non-zip payload`);
    }
    const bundle = Buffer.from(await r.arrayBuffer());
    const expectedSha = (r.headers.get("x-bundle-sha256") || "").toLowerCase();
    const observedSha = "0x" + createHash("sha256").update(bundle).digest("hex");
    if (expectedSha && expectedSha !== observedSha) {
      throw new Error(`downloadAgentSkill: sha256 mismatch — server claimed ${expectedSha} but bundle hashes to ${observedSha}`);
    }

    let manifest: string[] = [];
    try {
      const b64 = r.headers.get("x-manifest");
      if (b64) manifest = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch { /* keep empty */ }

    const settlementB64 = r.headers.get("x-payment-response");
    let settlement = { transaction: "", network: requirements.network, payer: this.wallet.address };
    if (settlementB64) {
      try { settlement = JSON.parse(Buffer.from(settlementB64, "base64").toString("utf8")); }
      catch { /* keep defaults */ }
    }

    if (opts.extractTo) {
      // Lazy-import adm-zip so callers who never extract don't pay the dep cost.
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(bundle);
      zip.extractAllTo(opts.extractTo, /*overwrite*/ true);
    }

    return {
      skillId,
      bundle,
      manifest,
      sizeBytes: bundle.length,
      bundleSha256: observedSha,
      receiptRootHash: r.headers.get("x-receipt-root") || "",
      settlement,
      payer: settlement.payer,
      paidW0G: ethers.formatEther(need),
    };
  }

  // ─── Receipts (fetch + verify) ─────────────────────────────────────────────

  /**
   * Download a receipt from 0G Storage via the network's indexer.
   *
   * Works against either a browser's fetch-based gateway or, in Node,
   * shells out to `@0gfoundation/0g-ts-sdk` if installed. To keep this
   * SDK dependency-light we use the indexer's HTTP file endpoint.
   */
  async fetchReceipt(rootHash: string): Promise<SkillReceipt> {
    const url = `${this.network.storageIndexer.replace(/\/$/, "")}/file?root=${rootHash}`;
    return httpJson<SkillReceipt>("fetchReceipt", url);
  }

  /**
   * Re-verify a receipt against its committed contents.
   *
   * Prompt receipts: recomputes input/output keccak256 + checks the TEE flag.
   * Agent-skill receipts: requires `opts.bundle` so we can sha256 the bytes
   * the caller actually holds and compare against the receipt's commitment.
   */
  verifyReceipt(
    receipt: SkillReceipt | AgentSkillReceipt,
    opts?: { bundle?: Buffer | Uint8Array }
  ): ReceiptVerification | AgentSkillReceiptVerification {
    if ((receipt as AgentSkillReceipt).kind === "agent-skill") {
      const r = receipt as AgentSkillReceipt;
      if (!opts?.bundle) {
        throw new Error(
          "verifyReceipt: agent-skill receipt requires opts.bundle to verify integrity. " +
          "Pass the bundle bytes you downloaded so we can re-hash them."
        );
      }
      const buf = Buffer.isBuffer(opts.bundle) ? opts.bundle : Buffer.from(opts.bundle);
      const observed = "0x" + createHash("sha256").update(buf).digest("hex");
      const sha256Ok = observed.toLowerCase() === String(r.bundleSha256).toLowerCase();
      return { kind: "agent-skill", sha256Ok, valid: sha256Ok };
    }

    const r = receipt as SkillReceipt;
    const inputHashOk =
      ethers.keccak256(ethers.toUtf8Bytes(r.input)).toLowerCase() ===
      r.inputHash.toLowerCase();
    const outputHashOk =
      ethers.keccak256(ethers.toUtf8Bytes(r.output)).toLowerCase() ===
      r.outputHash.toLowerCase();
    const teeVerified = !!r.teeVerified;
    return {
      kind: "prompt",
      inputHashOk,
      outputHashOk,
      teeVerified,
      valid: inputHashOk && outputHashOk && teeVerified,
    };
  }

  // ─── Links ──────────────────────────────────────────────────────────────────

  /** Get explorer URL for a transaction */
  txUrl(txHash: string): string {
    return `${this.network.chainScan}/tx/${txHash}`;
  }

  /** Get explorer URL for a skill NFT */
  skillUrl(skillId: number): string {
    return `${this.network.chainScan}/token/${this.network.registry}?a=${skillId}`;
  }

  /** Get StorageScan URL for a receipt */
  receiptUrl(receiptHash: string): string {
    return `${this.network.storageScan}/file/${receiptHash}`;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private _parseSkill(
    skillId: number,
    raw: Record<string, unknown>,
    owner: string,
    rep: [bigint, bigint, bigint]
  ): Skill {
    let metadata: SkillMetadata = {};
    try {
      metadata = JSON.parse(raw.metadata as string);
    } catch {
      // metadata might not be valid JSON
    }

    return {
      id: skillId,
      developer: raw.developer as string,
      owner,
      promptHash: raw.promptHash as string,
      computeProvider: raw.computeProvider as string,
      model: raw.model as string,
      price: ethers.formatEther(raw.priceA0GI as bigint),
      priceWei: raw.priceA0GI as bigint,
      metadata,
      executionCount: Number(raw.executionCount),
      successfulExecutions: Number(raw.successfulExecutions),
      successRate: Number(rep[2]),
      totalRevenueEarned: ethers.formatEther(raw.totalRevenueEarned as bigint),
      createdAt: new Date(Number(raw.createdAt) * 1000),
      active: raw.active as boolean,
    };
  }
}
