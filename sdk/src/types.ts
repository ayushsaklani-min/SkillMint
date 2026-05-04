// ─── Network Configuration ──────────────────────────────────────────────────

// ─── Payment token selection ────────────────────────────────────────────────

/** Selected payment asset for an execution. */
export enum PaymentToken {
  Native = "native",  // native 0G via msg.value
  W0G    = "w0g",     // ERC-20 W0G via approve+transferFrom or x402 EIP-3009
  USDC   = "usdc",    // ERC-20 USDC.E via approve+transferFrom or x402 EIP-3009
}

/** Per-token network metadata. */
export interface TokenInfo {
  address: string;
  decimals: number;
  /** EIP-712 domain `name` for EIP-3009 signing. */
  name: string;
  /** EIP-712 domain `version`. */
  version: string;
}

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  chainScan: string;
  storageScan: string;
  storageIndexer: string;
  registry: string;
  escrow: string;
  /** Canonical/deployed W0G (Wrapped 0G) ERC-20. */
  w0g: string;
  /** XSwap Bridged USDC (USDC.E) on 0G. Mock on testnet. */
  usdc: string;
  /** Per-token EIP-712 metadata for x402 signing. */
  tokens: { w0g: TokenInfo; usdc: TokenInfo };
  /** x402 network name used in paymentRequirements (e.g. "0g-testnet"). */
  x402Network: string;
  oracleUrl: string;
  x402Url: string;
}

// ─── Skill ──────────────────────────────────────────────────────────────────

export interface Skill {
  id: number;
  developer: string;
  owner: string;
  promptHash: string;
  computeProvider: string;
  model: string;
  /** Price in 0G (human-readable, e.g. "0.001"). */
  price: string;
  /** Price in 0G wei. */
  priceWei: bigint;
  /** Price in USDC (human-readable, e.g. "0.01"). 0/empty = USDC disabled for this skill. */
  priceUSDC: string;
  /** Price in USDC 6-decimal units. */
  priceUSDCRaw: bigint;
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
  /** Asset that funded this execution. address(0) = native 0G. */
  paymentToken: string;
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
  /** Network: "mainnet" (default) | "testnet" | custom NetworkConfig */
  network?: "testnet" | "mainnet" | NetworkConfig;
  /** Custom RPC URL (overrides network default) */
  rpcUrl?: string;
  /**
   * Oracle HTTP URL for prompt encryption + input handoff. Defaults to the
   * network's Vercel-proxied endpoint so consumers don't need to override.
   */
  oracleUrl?: string;
  /**
   * x402-payable skill endpoint root (e.g. for `executeX402`). Defaults to
   * the network's Vercel-proxied endpoint.
   */
  x402Url?: string;
}

// ─── Execution outcome + receipts ──────────────────────────────────────────

/** One-call result of `getExecutionOutcome(id)` — merges on-chain + storage. */
export interface ExecutionOutcome {
  executionId: string;
  skillId: number;
  settled: boolean;
  refunded: boolean;
  receiptHash: string | null;
  payee: string | null;
  payeeAmount: string | null;
  treasuryAmount: string | null;
  /** Full receipt body from 0G Storage; null if still settling or not yet confirmed. */
  receipt: SkillReceipt | null;
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

// ─── x402 (pay-with-W0G) ────────────────────────────────────────────────────

/** EIP-3009 authorization payload signed by the agent. */
export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/** x402 v1 payload carried in the X-PAYMENT header. */
export interface PaymentPayload {
  x402Version: 1;
  scheme: "exact";
  network: string;
  payload: {
    signature: string;
    authorization: EIP3009Authorization;
  };
}

/** Requirements returned by an x402 skill server in the 402 body. */
export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: { name?: string; version?: string };
}

export interface X402ExecuteResult {
  skillId: number;
  output: string;
  receiptRootHash: string;
  settlement: { transaction: string; network: string; payer: string; blockNumber?: number };
  payer: string;
  paidW0G: string;
  /** USDC.E amount paid; "0" if x402 used W0G. */
  paidUSDC: string;
}

/** Full receipt JSON stored on 0G Storage after a successful skill run. */
export interface SkillReceipt {
  skillId: number;
  input: string;
  inputHash: string;
  outputHash: string;
  output: string;
  chatID: string;
  teeVerified: boolean;
  providerAddress: string;
  model?: string;
  nftOwner: string;
  executionId?: string;
  /** Native 0G flow */
  paidA0GI?: string;
  /** x402 W0G flow */
  paidW0G?: string;
  /** USDC.E flow (either dashboard or x402) */
  paidUSDC?: string;
  payer?: string;
  network?: string;
  timestamp: number;
  /** Asset paid in. address(0) when missing or native. */
  paymentToken?: string;
}

/** Result of re-verifying a prompt-skill receipt end-to-end. */
export interface ReceiptVerification {
  kind?: "prompt";
  inputHashOk: boolean;
  outputHashOk: boolean;
  teeVerified: boolean;
  /** All three checks must pass for a receipt to be considered valid. */
  valid: boolean;
}

// ─── Agent skills (folder-bundle x402 flow) ────────────────────────────────

/** Sentinel `computeProvider` used by agent-skill NFTs. */
export const AGENT_SKILL_PROVIDER = "0x0000000000000000000000000000000000000a6e";
export const AGENT_SKILL_MODEL = "agent-skill";

/** Metadata JSON shape stored on-chain for an agent-skill (parsed from `Skill.metadata`). */
export interface AgentSkillMetadata extends SkillMetadata {
  kind: "agent-skill";
  bundleStorageRoot: string;
  bundleIv: string;
  bundleAlgo: "aes-256-gcm";
  bundleSha256: string;
  sizeBytes: number;
  manifest: string[];
  format?: "claude-skill";
  compatibleWith?: string[];
}

export interface RegisterAgentSkillResult {
  skillId: number;
  txHash: string;
  bundleStorageRoot: string;
  bundleSha256: string;
}

export interface DownloadAgentSkillResult {
  skillId: number;
  /** Decrypted, sha256-verified bundle bytes (the original ZIP). */
  bundle: Buffer;
  manifest: string[];
  sizeBytes: number;
  bundleSha256: string;
  receiptRootHash: string;
  settlement: { transaction: string; network: string; payer: string; blockNumber?: number };
  payer: string;
  paidW0G: string;
}

/** Receipt body uploaded to 0G Storage when an agent-skill is downloaded. */
export interface AgentSkillReceipt {
  skillId: number;
  kind: "agent-skill";
  payer: string;
  paidW0G: string;
  network: string;
  bundleStorageRoot: string;
  bundleSha256: string;
  manifest: string[];
  sizeBytes: number;
  nftOwner: string;
  timestamp: number;
}

export interface AgentSkillReceiptVerification {
  kind: "agent-skill";
  /** sha256 of the bundle the caller passed matches the receipt's commitment. */
  sha256Ok: boolean;
  valid: boolean;
}
