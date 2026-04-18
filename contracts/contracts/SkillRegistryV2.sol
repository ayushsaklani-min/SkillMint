// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC721}          from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981}         from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Strings}         from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64}          from "@openzeppelin/contracts/utils/Base64.sol";

/// @title SkillRegistryV2
/// @notice NFT-ified skill registry. Each skill is an ERC-721 token.
///         Revenue flows to ownerOf(skillId), not to the original developer.
///         Developer address is preserved as immutable creator for ERC-2981 royalties.
interface IERC4906 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

contract SkillRegistryV2 is ERC721, ERC2981, AccessControl, ReentrancyGuard, IERC4906 {
    using Strings for uint256;

    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant MIGRATOR_ROLE = keccak256("MIGRATOR_ROLE");
    bytes32 public constant ESCROW_ROLE   = keccak256("ESCROW_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Skill {
        address developer;          // IMMUTABLE original creator (royalty target)
        bytes32 promptHash;         // rootHash from 0G Storage
        address computeProvider;    // 0G Compute provider address
        string  model;              // e.g. "qwen/qwen-2.5-7b-instruct"
        uint256 priceA0GI;          // price in wei
        string  metadata;           // JSON: name, description, schemas
        uint256 executionCount;
        uint256 successfulExecutions;
        uint256 totalRevenueEarned;
        uint64  createdAt;
        bool    active;
        bool    exists;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    mapping(uint256 => Skill) private _skills;
    mapping(address => uint256[]) private _developerSkills;
    uint256 public nextSkillId = 1;
    bool    public migrationFinalized;
    uint96  public constant ROYALTY_BPS = 500; // 5% on secondary sales

    // ─── Events ───────────────────────────────────────────────────────────────
    event SkillMinted(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 price);
    event SkillTransferred(uint256 indexed skillId, address indexed from, address indexed to);
    event SkillPriceUpdated(uint256 indexed skillId, uint256 oldPrice, uint256 newPrice);
    event SkillDeactivated(uint256 indexed skillId);
    event ExecutionRecorded(uint256 indexed skillId, bytes32 receiptHash, bool success);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) ERC721("0G Skill", "SKILL") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MIGRATOR_ROLE, admin);
    }

    // ─── Skill Registration (mints NFT) ───────────────────────────────────────
    /// @notice Register a new skill on-chain. Mints an ERC-721 NFT to the caller.
    function registerSkill(
        bytes32 promptHash,
        address computeProvider,
        string calldata model,
        uint256 priceA0GI,
        string calldata _metadata
    ) external nonReentrant returns (uint256 skillId) {
        require(promptHash != bytes32(0), "Invalid promptHash");
        require(computeProvider != address(0), "Invalid provider");
        require(bytes(model).length > 0, "Empty model");
        require(priceA0GI > 0, "Price must be > 0");

        skillId = nextSkillId++;
        _skills[skillId] = Skill({
            developer:          msg.sender,
            promptHash:         promptHash,
            computeProvider:    computeProvider,
            model:              model,
            priceA0GI:          priceA0GI,
            metadata:           _metadata,
            executionCount:     0,
            successfulExecutions: 0,
            totalRevenueEarned: 0,
            createdAt:          uint64(block.timestamp),
            active:             true,
            exists:             true
        });

        _developerSkills[msg.sender].push(skillId);

        // _mint (NOT _safeMint) — avoids onERC721Received reentrancy
        _mint(msg.sender, skillId);
        _setTokenRoyalty(skillId, msg.sender, ROYALTY_BPS);

        emit SkillMinted(skillId, msg.sender, promptHash, model, priceA0GI);
    }

    // ─── Migration from V1 ────────────────────────────────────────────────────
    /// @notice Migrate skills from V1 registry. Admin only, before finalization.
    function migrate(
        uint256[] calldata ids,
        Skill[] calldata skills
    ) external onlyRole(MIGRATOR_ROLE) {
        require(!migrationFinalized, "migration finalized");
        require(ids.length == skills.length, "len mismatch");
        for (uint256 i; i < ids.length; ++i) {
            require(!_skills[ids[i]].exists, "already migrated");
            _skills[ids[i]] = skills[i];
            _developerSkills[skills[i].developer].push(ids[i]);
            _mint(skills[i].developer, ids[i]);
            _setTokenRoyalty(ids[i], skills[i].developer, ROYALTY_BPS);
            if (ids[i] >= nextSkillId) nextSkillId = ids[i] + 1;
            emit SkillMinted(ids[i], skills[i].developer, skills[i].promptHash, skills[i].model, skills[i].priceA0GI);
        }
    }

    /// @notice Permanently disable migration.
    function finalizeMigration() external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationFinalized = true;
    }

    // ─── Escrow-only State Mutations ──────────────────────────────────────────
    /// @notice Called by SkillEscrowV2 after execution.
    function recordExecution(
        uint256 skillId,
        bytes32 receiptHash,
        bool success,
        uint256 revenueAdded
    ) external onlyRole(ESCROW_ROLE) {
        Skill storage s = _skills[skillId];
        s.executionCount += 1;
        if (success) {
            s.successfulExecutions += 1;
        }
        s.totalRevenueEarned += revenueAdded;
        emit ExecutionRecorded(skillId, receiptHash, success);
        emit MetadataUpdate(skillId); // EIP-4906 — marketplaces refresh
    }

    // ─── Owner Actions ────────────────────────────────────────────────────────
    /// @notice NFT owner updates skill price.
    function updatePrice(uint256 skillId, uint256 newPrice) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        require(newPrice > 0, "Price must be > 0");
        uint256 old = _skills[skillId].priceA0GI;
        _skills[skillId].priceA0GI = newPrice;
        emit SkillPriceUpdated(skillId, old, newPrice);
        emit MetadataUpdate(skillId);
    }

    /// @notice NFT owner deactivates skill (halts new executions).
    function deactivateSkill(uint256 skillId) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        _skills[skillId].active = false;
        emit SkillDeactivated(skillId);
        emit MetadataUpdate(skillId);
    }

    /// @notice NFT owner reactivates skill.
    function activateSkill(uint256 skillId) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        _skills[skillId].active = true;
        emit MetadataUpdate(skillId);
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    /// @notice Returns full skill data.
    function getSkill(uint256 skillId) external view returns (Skill memory) {
        require(_skills[skillId].exists, "skill: dne");
        return _skills[skillId];
    }

    /// @notice Backwards-compat skill count.
    function skillCount() external view returns (uint256) {
        return nextSkillId - 1;
    }

    /// @notice Returns (total, successful, successRate 0-100).
    function getReputationScore(uint256 skillId)
        external view returns (uint256 total, uint256 successful, uint256 successRate)
    {
        require(_skills[skillId].exists, "skill: dne");
        Skill storage s = _skills[skillId];
        total = s.executionCount;
        successful = s.successfulExecutions;
        successRate = total == 0 ? 0 : (successful * 100) / total;
    }

    /// @notice Returns all skillIds originally created by a developer.
    function getDeveloperSkills(address dev) external view returns (uint256[] memory) {
        return _developerSkills[dev];
    }

    // ─── On-chain tokenURI ────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_skills[tokenId].exists, "skill: dne");
        Skill storage s = _skills[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"0G Skill #', tokenId.toString(),
            '","description":"SkillMint NFT - verified AI skill on 0G. Revenue flows to the NFT owner."',
            ',"external_url":"https://skillmint.xyz/skill/', tokenId.toString(), '"',
            ',"attributes":[',
                '{"trait_type":"Executions","value":', s.executionCount.toString(), '},',
                '{"trait_type":"Successful","value":', s.successfulExecutions.toString(), '},',
                '{"trait_type":"Revenue (wei)","value":"', s.totalRevenueEarned.toString(), '"},',
                '{"trait_type":"Active","value":"', s.active ? 'true' : 'false', '"},',
                '{"trait_type":"Model","value":"', s.model, '"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ─── Transfer Hook ────────────────────────────────────────────────────────
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        // Emit transfer event for indexing (skip mints: from == address(0))
        if (batchSize == 1 && from != address(0)) {
            emit SkillTransferred(firstTokenId, from, to);
        }
    }

    // ─── ERC-165 ──────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981, AccessControl) returns (bool)
    {
        // 0x49064906 = IERC4906
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }
}
