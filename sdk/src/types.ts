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
