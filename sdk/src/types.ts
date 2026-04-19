// ─── Network Configuration ──────────────────────────────────────────────────

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  chainScan: string;
  storageScan: string;
  storageIndexer: string;
  registry: string;
  escrow: string;
}

// ─── Skill ──────────────────────────────────────────────────────────────────

export interface Skill {
  id: number;
  developer: string;
  owner: string;
  promptHash: string;
  computeProvider: string;
  model: string;
  /** Price in A0GI (human-readable, e.g. "0.001") */
  price: string;
  /** Price in wei */
  priceWei: bigint;
  metadata: SkillMetadata;
  executionCount: number;
  successfulExecutions: number;
  successRate: number;
  totalRevenueEarned: string;
  createdAt: Date;
  active: boolean;
}

export interface SkillMetadata {
  name?: string;
  description?: string;
  /** Storage root of the encrypted prompt on 0G Storage (AES-256-GCM). */
  storageRoot?: string;
  /** Base64 IV used for prompt encryption. */
  iv?: string;
  /** Encryption algorithm identifier (e.g. "aes-256-gcm"). */
  algo?: string;
  /** Oracle key identifier used to encrypt the prompt. */
  keyId?: string;
  /**
   * Legacy plaintext prompt. Only populated for pre-encryption skills and
   * kept for backward-compatible oracle fallback.
   */
  systemPrompt?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface Execution {
  executionId: string;
  skillId: number;
  agent: string;
  inputHash: string;
  amount: string;
  amountWei: bigint;
  payeeAtFunding: string;
  createdAt: Date;
  settled: boolean;
  refunded: boolean;
}

export interface ExecutionResult {
  executionId: string;
  skillId: number;
  txHash: string;
  receiptHash: string;
  payee: string;
  payeeAmount: string;
  treasuryAmount: string;
}

export interface ExecutionRequest {
  executionId: string;
  skillId: number;
  txHash: string;
  amount: string;
}

// ─── Reputation ─────────────────────────────────────────────────────────────

export interface Reputation {
  total: number;
  successful: number;
  successRate: number;
}

// ─── Revenue ────────────────────────────────────────────────────────────────

export interface RevenueInfo {
  /** Pending revenue claimable via withdrawPayments (human-readable A0GI) */
  pending: string;
  /** Pending revenue in wei */
  pendingWei: bigint;
}

// ─── Client Options ─────────────────────────────────────────────────────────

export interface SkillMintOptions {
  /** Private key for signing transactions */
  privateKey: string;
  /** Network: "testnet" | "mainnet" or a custom NetworkConfig */
  network?: "testnet" | "mainnet" | NetworkConfig;
  /** Custom RPC URL (overrides network default) */
  rpcUrl?: string;
  /**
   * Oracle HTTP URL for prompt encryption + input handoff.
   * Required for publishing encrypted skills and executing with real input
   * passthrough. Defaults to https://oracle.skillmint-0g.xyz.
   */
  oracleUrl?: string;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface ExecutionRequestedEvent {
  executionId: string;
  skillId: number;
  agent: string;
  inputHash: string;
  amount: string;
}

export interface ExecutionConfirmedEvent {
  executionId: string;
  receiptHash: string;
  payee: string;
  payeeAmount: string;
  treasuryAmount: string;
}
