import { ethers } from "ethers";
import { REGISTRY_ABI, ESCROW_ABI } from "./abis.js";
import { TESTNET, MAINNET } from "./constants.js";
import type {
  NetworkConfig,
  Skill,
  SkillMetadata,
  SkillMintOptions,
  Execution,
  ExecutionRequest,
  ExecutionResult,
  Reputation,
  RevenueInfo,
} from "./types.js";

export class SkillMintClient {
  readonly provider: ethers.JsonRpcProvider;
  readonly wallet: ethers.Wallet;
  readonly registry: ethers.Contract;
  readonly escrow: ethers.Contract;
  readonly network: NetworkConfig;

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

  /** List all skills on-chain */
  async listSkills(): Promise<Skill[]> {
    const count = await this.getSkillCount();
    if (count === 0) return [];

    const promises = [];
    for (let i = 1; i <= count; i++) {
      promises.push(this.getSkill(i));
    }
    return Promise.all(promises);
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

    return {
      executionId: event.args[0] as string,
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
    const promptHash = ethers.keccak256(ethers.toUtf8Bytes(params.systemPrompt));
    const priceWei = ethers.parseEther(params.price);
    const metadata = JSON.stringify({
      name: params.name,
      description: params.description,
      systemPrompt: params.systemPrompt,
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
