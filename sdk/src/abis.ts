// ─── SkillRegistryV2 (ERC-721 NFT) ──────────────────────────────────────────

export const REGISTRY_ABI = [
  // Skill management
  "function registerSkill(bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string _metadata) returns (uint256)",
  "function getSkill(uint256 skillId) view returns (tuple(address developer, bytes32 promptHash, address computeProvider, string model, uint256 priceA0GI, string metadata, uint256 executionCount, uint256 successfulExecutions, uint256 totalRevenueEarned, uint64 createdAt, bool active, bool exists))",
  "function getReputationScore(uint256 skillId) view returns (uint256 total, uint256 successful, uint256 successRate)",
  "function getDeveloperSkills(address dev) view returns (uint256[])",
  "function skillCount() view returns (uint256)",
  "function updatePrice(uint256 skillId, uint256 newPrice)",
  "function deactivateSkill(uint256 skillId)",
  "function activateSkill(uint256 skillId)",

  // ERC-721
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

  // ERC-2981 Royalty
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",

  // Events
  "event SkillMinted(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 price)",
  "event SkillTransferred(uint256 indexed skillId, address indexed from, address indexed to)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event SkillPriceUpdated(uint256 indexed skillId, uint256 oldPrice, uint256 newPrice)",
  "event SkillDeactivated(uint256 indexed skillId)",
  "event ExecutionRecorded(uint256 indexed skillId, bytes32 receiptHash, bool success)",
] as const;

// ─── SkillEscrowV2 (PullPayment + payee snapshot) ──────────────────────────

export const ESCROW_ABI = [
  "function requestExecution(uint256 skillId, bytes32 inputHash) payable returns (bytes32)",
  "function withdrawPayments(address payable payee)",
  "function payments(address dest) view returns (uint256)",
  "function getExecution(bytes32 executionId) view returns (tuple(bytes32 executionId, uint256 skillId, address agent, bytes32 inputHash, uint256 amount, address payeeAtFunding, uint256 createdAt, bool settled, bool refunded))",
  "function refund(bytes32 executionId)",
  "function TIMEOUT() view returns (uint256)",

  // Events
  "event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount)",
  "event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, address payee, uint256 payeeAmount, uint256 treasuryAmount)",
  "event ExecutionRefunded(bytes32 indexed executionId, address indexed agent, uint256 amount)",
] as const;
