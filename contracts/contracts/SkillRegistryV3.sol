// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC721}          from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981}         from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Strings}         from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64}          from "@openzeppelin/contracts/utils/Base64.sol";

interface IERC4906 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

/// @title SkillRegistryV3
/// @notice V2 + dual-price storage (priceA0GI + priceUSDC) + asset-aware priceFor().
contract SkillRegistryV3 is ERC721, ERC2981, AccessControl, ReentrancyGuard, IERC4906 {
    using Strings for uint256;

    bytes32 public constant MIGRATOR_ROLE = keccak256("MIGRATOR_ROLE");
    bytes32 public constant ESCROW_ROLE   = keccak256("ESCROW_ROLE");

    /// @dev Asset addresses set at deploy time. Used by priceFor() to map
    ///      paymentToken → which on-chain price field to use. Native is address(0).
    address public immutable W0G;
    address public immutable USDC;

    struct Skill {
        address developer;
        bytes32 promptHash;
        address computeProvider;
        string  model;
        uint256 priceA0GI;          // native 0G wei (also W0G; 1:1)
        uint256 priceUSDC;          // 6-decimal USDC.E units; 0 = USDC disabled for this skill
        string  metadata;
        uint256 executionCount;
        uint256 successfulExecutions;
        uint256 totalRevenueEarned;
        uint64  createdAt;
        bool    active;
        bool    exists;
    }

    mapping(uint256 => Skill) private _skills;
    mapping(address => uint256[]) private _developerSkills;
    uint256 public nextSkillId = 1;
    bool    public migrationFinalized;
    uint96  public constant ROYALTY_BPS = 500;

    error UnsupportedToken(address token);
    error USDCDisabled(uint256 skillId);

    event SkillMinted(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 priceA0GI, uint256 priceUSDC);
    event SkillTransferred(uint256 indexed skillId, address indexed from, address indexed to);
    event SkillPriceUpdated(uint256 indexed skillId, uint256 oldA0GI, uint256 newA0GI, uint256 oldUSDC, uint256 newUSDC);
    event SkillDeactivated(uint256 indexed skillId);
    event ExecutionRecorded(uint256 indexed skillId, bytes32 receiptHash, bool success);

    constructor(address admin, address w0g, address usdc) ERC721("0G Skill", "SKILL") {
        require(w0g != address(0) && usdc != address(0), "tokens must be set");
        W0G = w0g;
        USDC = usdc;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MIGRATOR_ROLE, admin);
    }

    function registerSkill(
        bytes32 promptHash,
        address computeProvider,
        string calldata model,
        uint256 priceA0GI,
        uint256 priceUSDC,
        string calldata _metadata
    ) external nonReentrant returns (uint256 skillId) {
        require(promptHash != bytes32(0), "Invalid promptHash");
        require(computeProvider != address(0), "Invalid provider");
        require(bytes(model).length > 0, "Empty model");
        require(priceA0GI > 0, "Price must be > 0");
        // priceUSDC == 0 IS allowed — means publisher opted out of USDC for this skill.

        skillId = nextSkillId++;
        _skills[skillId] = Skill({
            developer:            msg.sender,
            promptHash:           promptHash,
            computeProvider:      computeProvider,
            model:                model,
            priceA0GI:            priceA0GI,
            priceUSDC:            priceUSDC,
            metadata:             _metadata,
            executionCount:       0,
            successfulExecutions: 0,
            totalRevenueEarned:   0,
            createdAt:            uint64(block.timestamp),
            active:               true,
            exists:               true
        });

        _developerSkills[msg.sender].push(skillId);
        _mint(msg.sender, skillId);
        _setTokenRoyalty(skillId, msg.sender, ROYALTY_BPS);
        emit SkillMinted(skillId, msg.sender, promptHash, model, priceA0GI, priceUSDC);
    }

    /// @notice Returns the on-chain price for `skillId` denominated in `paymentToken`.
    /// @dev address(0) and W0G both map to priceA0GI (1:1). USDC maps to priceUSDC.
    ///      Reverts USDCDisabled if priceUSDC == 0 and caller asked for USDC.
    function priceFor(uint256 skillId, address paymentToken) external view returns (uint256) {
        require(_skills[skillId].exists, "skill: dne");
        if (paymentToken == address(0) || paymentToken == W0G) {
            return _skills[skillId].priceA0GI;
        }
        if (paymentToken == USDC) {
            uint256 p = _skills[skillId].priceUSDC;
            if (p == 0) revert USDCDisabled(skillId);
            return p;
        }
        revert UnsupportedToken(paymentToken);
    }

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
            emit SkillMinted(ids[i], skills[i].developer, skills[i].promptHash, skills[i].model, skills[i].priceA0GI, skills[i].priceUSDC);
        }
    }

    function finalizeMigration() external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationFinalized = true;
    }

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
        emit MetadataUpdate(skillId);
    }

    /// @notice NFT owner updates BOTH prices atomically. Pass priceUSDC=0 to disable USDC.
    function updatePrice(uint256 skillId, uint256 newPriceA0GI, uint256 newPriceUSDC) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        require(newPriceA0GI > 0, "Price must be > 0");
        Skill storage s = _skills[skillId];
        uint256 oldA0GI = s.priceA0GI;
        uint256 oldUSDC = s.priceUSDC;
        s.priceA0GI = newPriceA0GI;
        s.priceUSDC = newPriceUSDC;
        emit SkillPriceUpdated(skillId, oldA0GI, newPriceA0GI, oldUSDC, newPriceUSDC);
        emit MetadataUpdate(skillId);
    }

    function deactivateSkill(uint256 skillId) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        _skills[skillId].active = false;
        emit SkillDeactivated(skillId);
        emit MetadataUpdate(skillId);
    }

    function activateSkill(uint256 skillId) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        _skills[skillId].active = true;
        emit MetadataUpdate(skillId);
    }

    function getSkill(uint256 skillId) external view returns (Skill memory) {
        require(_skills[skillId].exists, "skill: dne");
        return _skills[skillId];
    }

    function skillCount() external view returns (uint256) {
        return nextSkillId - 1;
    }

    function getReputationScore(uint256 skillId)
        external view returns (uint256 total, uint256 successful, uint256 successRate)
    {
        require(_skills[skillId].exists, "skill: dne");
        Skill storage s = _skills[skillId];
        total = s.executionCount;
        successful = s.successfulExecutions;
        successRate = total == 0 ? 0 : (successful * 100) / total;
    }

    function getDeveloperSkills(address dev) external view returns (uint256[] memory) {
        return _developerSkills[dev];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_skills[tokenId].exists, "skill: dne");
        Skill storage s = _skills[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"0G Skill #', tokenId.toString(),
            '","description":"SkillMint NFT - verified AI skill on 0G. Revenue flows to the NFT owner."',
            ',"external_url":"https://skillmint-0g.vercel.app/skill/', tokenId.toString(), '"',
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

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._afterTokenTransfer(from, to, firstTokenId, batchSize);
        if (batchSize == 1 && from != address(0)) {
            emit SkillTransferred(firstTokenId, from, to);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981, AccessControl) returns (bool)
    {
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }
}
