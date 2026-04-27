export const TESTNET = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  chainScan: "https://chainscan-galileo.0g.ai",
  storageScan: "https://storagescan-galileo.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  registry: "0x7e244F7F4fcfaE918a9554e3E59485db2A5687e4",
  escrow: "0xe2841b105B695610f2c1194f8865474A536184dB",
  w0g: "0x45B5287f055Ac4B1C8365Fb017009B40a8e72D0D",
  x402Network: "0g-testnet",
};

export const MAINNET = {
  chainId: 16661,
  rpcUrl: "https://evmrpc.0g.ai",
  chainScan: "https://chainscan.0g.ai",
  storageScan: "https://storagescan.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  registry: "0x14cE1f53089c414bFf75e1c462E45ecc19Bf8F09",
  escrow:   "0xD7385368cEf64c27fecfCC63E1E8F19fA09f8Ea5",
  // SkillMint DemoW0G (EIP-3009 enabled) — distinct from canonical Wrapped0GBase precompile.
  w0g:      "0x7f73A890F0F608Fa32e1dd29a5F552bC7dDa0e01",
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

// ─── SkillRegistryV2 (ERC-721 NFT) ───────────────────────────────────────
export const REGISTRY_ABI = [
  "function registerSkill(bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string _metadata) returns (uint256)",
  "function getSkill(uint256 skillId) view returns (tuple(address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata, uint256 executionCount, uint256 successfulExecutions, uint256 totalRevenueEarned, uint64 createdAt, bool active, bool exists))",
  "function getReputationScore(uint256 skillId) view returns (uint256 total, uint256 successful, uint256 successRate)",
  "function getDeveloperSkills(address dev) view returns (uint256[])",
  "function skillCount() view returns (uint256)",
  "function updatePrice(uint256 skillId, uint256 newPrice)",
  "function deactivateSkill(uint256 skillId)",
  "function activateSkill(uint256 skillId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
  "event SkillMinted(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 price)",
  "event SkillTransferred(uint256 indexed skillId, address indexed from, address indexed to)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// ─── W0G (Wrapped 0G · ERC-20 + EIP-3009) ────────────────────────────────
export const W0G_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function version() view returns (string)",
];

// ─── SkillEscrowV2 (PullPayment + payee snapshot) ────────────────────────
export const ESCROW_ABI = [
  "function requestExecution(uint256 skillId, bytes32 inputHash) payable returns (bytes32)",
  "function withdrawPayments(address payable payee)",
  "function payments(address dest) view returns (uint256)",
  "function getExecution(bytes32 executionId) view returns (tuple(bytes32 executionId, uint256 skillId, address agent, bytes32 inputHash, uint256 amount, address payeeAtFunding, uint256 createdAt, bool settled, bool refunded))",
  "function TIMEOUT() view returns (uint256)",
  "event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount)",
  "event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, address payee, uint256 payeeAmount, uint256 treasuryAmount)",
  "event ExecutionRefunded(bytes32 indexed executionId, address indexed agent, uint256 amount)",
];
