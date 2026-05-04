export const TESTNET = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  chainScan: "https://chainscan-galileo.0g.ai",
  storageScan: "https://storagescan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  registry: "0xe052332AA56c179FF9A8B2bCFCCb5679d2BCe9d3",
  escrow:   "0x4ca3Fe8a467C734c31a34a345F6819e5767cAD9C",
  w0g:      "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
  usdc:     "0x1605FF6E8aB0Bd7F846cf99268B669764F981C06",
  tokens: {
    w0g:  { address: "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D", decimals: 18, name: "Wrapped 0G", version: "1" },
    usdc: { address: "0x1605FF6E8aB0Bd7F846cf99268B669764F981C06", decimals: 6,  name: "Mock USDC",  version: "1" },
  },
  x402Network: "0g-testnet",
};

export const MAINNET = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  chainScan: "https://chainscan.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  registry: "0xdF28e06899955092DF81f0DBea03496D1Ac8904E",
  escrow:   "0xA0e5A7d722399f59A0Ee4B8DF740107FBC63f7ae",
  w0g:      "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01",
  usdc:     "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e",
  tokens: {
    w0g:  { address: "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01", decimals: 18, name: "Wrapped 0G", version: "1" },
    usdc: { address: "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e", decimals: 6,  name: "USDC",        version: "2" },
  },
  x402Network: "0g-mainnet",
};

// Public-facing network — flip to TESTNET to switch UI to 0G Galileo.
// Mainnet is the default; set NEXT_PUBLIC_NETWORK=testnet to revert.
// trim() guards against shell-piped values that smuggle in \n or \r\n.
export const NETWORK =
  (process.env.NEXT_PUBLIC_NETWORK || "").trim().toLowerCase() === "testnet" ? TESTNET : MAINNET;

// ─── Agent-skill sentinels (matches sdk/src/types.ts) ────────────────────
// Contract requires non-zero computeProvider + non-empty model. Agent-skills
// use these stable sentinels so SDK + frontend can filter on them.
export const AGENT_SKILL_PROVIDER = "0x0000000000000000000000000000000000000a6e";
export const AGENT_SKILL_MODEL = "agent-skill";

// ─── SkillRegistryV3 (ERC-721 NFT) ───────────────────────────────────────
export const REGISTRY_ABI = [
  "function registerSkill(bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, uint256 priceUSDC, string _metadata) returns (uint256)",
  "function getSkill(uint256 skillId) view returns (tuple(address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, uint256 priceUSDC, string metadata, uint256 executionCount, uint256 successfulExecutions, uint256 totalRevenueEarned, uint64 createdAt, bool active, bool exists))",
  "function priceFor(uint256 skillId, address paymentToken) view returns (uint256)",
  "function getReputationScore(uint256 skillId) view returns (uint256 total, uint256 successful, uint256 successRate)",
  "function getDeveloperSkills(address dev) view returns (uint256[])",
  "function skillCount() view returns (uint256)",
  "function updatePrice(uint256 skillId, uint256 newPriceA0GI, uint256 newPriceUSDC)",
  "function deactivateSkill(uint256 skillId)",
  "function activateSkill(uint256 skillId)",
  "function W0G() view returns (address)",
  "function USDC() view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
  "event SkillMinted(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 priceA0GI, uint256 priceUSDC)",
  "event SkillTransferred(uint256 indexed skillId, address indexed from, address indexed to)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event SkillPriceUpdated(uint256 indexed skillId, uint256 oldA0GI, uint256 newA0GI, uint256 oldUSDC, uint256 newUSDC)",
  "event SkillDeactivated(uint256 indexed skillId)",
  "event ExecutionRecorded(uint256 indexed skillId, bytes32 receiptHash, bool success)",
] as const;

// ─── W0G (Wrapped 0G · ERC-20 + EIP-3009) ────────────────────────────────
export const W0G_ABI = [
  // ERC-20
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",

  // Wrap / unwrap
  "function deposit() payable",
  "function withdraw(uint256 wad)",

  // EIP-3009
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",

  // Events
  "event Deposit(address indexed dst, uint256 wad)",
  "event Withdrawal(address indexed src, uint256 wad)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

// ─── USDC.E (Bridged USDC, Circle FiatToken v2) ───────────────────────────
export const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function paused() view returns (bool)",
  "function isBlacklisted(address) view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
] as const;

// ─── SkillEscrowV3 (PullPayment + payee snapshot + multi-token) ──────────
export const ESCROW_ABI = [
  "function requestExecution(uint256 skillId, bytes32 inputHash) payable returns (bytes32)",
  "function requestExecutionWithToken(uint256 skillId, bytes32 inputHash, address token, uint256 amount) returns (bytes32)",
  "function requestExecutionPrefunded(uint256 skillId, bytes32 inputHash, address token, uint256 amount, address agent) returns (bytes32)",
  "function withdrawPayments(address payable payee)",
  "function payments(address dest) view returns (uint256)",
  "function refund(bytes32 executionId)",
  "function TIMEOUT() view returns (uint256)",
  "function getExecution(bytes32 executionId) view returns (tuple(bytes32 executionId, uint256 skillId, address agent, bytes32 inputHash, uint256 amount, address payeeAtFunding, uint256 createdAt, bool settled, bool refunded, address paymentToken))",
  "function supportedTokens(address) view returns (bool)",
  "function unallocatedTokenBalance(address) view returns (uint256)",
  "function FACILITATOR_ROLE() view returns (bytes32)",
  "function ORACLE_ROLE() view returns (bytes32)",
  "event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount, address paymentToken)",
  "event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, address payee, uint256 payeeAmount, uint256 treasuryAmount, address paymentToken)",
  "event ExecutionRefunded(bytes32 indexed executionId, address indexed agent, uint256 amount, address paymentToken)",
  "event TokenAdded(address indexed token)",
  "event TokenRemoved(address indexed token)",
  "event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury)",
] as const;
