// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title SkillRegistry
/// @notice On-chain registry for AI skills. Stores prompt hash, provider, model, price, reputation.
contract SkillRegistry {
    // ─── Structs ───────────────────────────────────────────────────────────────

    struct Skill {
        uint256 skillId;
        address developer;
        bytes32 promptHash;       // rootHash from 0G Storage
        address computeProvider;  // 0G Compute provider address
        string  model;            // e.g. "qwen/qwen-2.5-7b-instruct"
        uint256 priceA0GI;        // price in wei (A0GI)
        string  metadata;         // JSON: name, description, inputSchema, outputSchema
        bool    active;
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 createdAt;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    uint256 public skillCount;
    address public oracle;
    address public owner;

    mapping(uint256 => Skill) private skills;
    mapping(address => uint256[]) private developerSkills;

    // ─── Events ────────────────────────────────────────────────────────────────

    event SkillRegistered(uint256 indexed skillId, address indexed developer, bytes32 promptHash, string model, uint256 price);
    event SkillPriceUpdated(uint256 indexed skillId, uint256 newPrice);
    event SkillDeactivated(uint256 indexed skillId);
    event ExecutionRecorded(uint256 indexed skillId, bytes32 receiptHash, bool success);
    event OracleUpdated(address indexed newOracle);

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    modifier skillExists(uint256 skillId) {
        require(skillId > 0 && skillId <= skillCount, "Skill not found");
        _;
    }

    modifier onlySkillOwner(uint256 skillId) {
        require(skills[skillId].developer == msg.sender, "Not skill owner");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    // ─── Write Functions ───────────────────────────────────────────────────────

    /// @notice Register a new skill on-chain
    /// @param promptHash  rootHash returned by 0G Storage after uploading prompt template
    /// @param computeProvider  0G Compute provider address for routing inference
    /// @param model  model name e.g. "qwen/qwen-2.5-7b-instruct"
    /// @param priceA0GI  price agents pay per execution (in wei)
    /// @param metadata  JSON string with name, description, schemas
    function registerSkill(
        bytes32 promptHash,
        address computeProvider,
        string calldata model,
        uint256 priceA0GI,
        string calldata metadata
    ) external returns (uint256 skillId) {
        require(promptHash != bytes32(0), "Invalid promptHash");
        require(computeProvider != address(0), "Invalid provider");
        require(bytes(model).length > 0, "Empty model");
        require(priceA0GI > 0, "Price must be > 0");

        skillCount++;
        skillId = skillCount;

        skills[skillId] = Skill({
            skillId: skillId,
            developer: msg.sender,
            promptHash: promptHash,
            computeProvider: computeProvider,
            model: model,
            priceA0GI: priceA0GI,
            metadata: metadata,
            active: true,
            totalExecutions: 0,
            successfulExecutions: 0,
            createdAt: block.timestamp
        });

        developerSkills[msg.sender].push(skillId);

        emit SkillRegistered(skillId, msg.sender, promptHash, model, priceA0GI);
    }

    /// @notice Called by oracle after execution to record reputation
    function recordExecution(
        uint256 skillId,
        bytes32 receiptHash,
        bool success
    ) external onlyOracle skillExists(skillId) {
        skills[skillId].totalExecutions++;
        if (success) {
            skills[skillId].successfulExecutions++;
        }
        emit ExecutionRecorded(skillId, receiptHash, success);
    }

    /// @notice Developer updates skill price
    function updateSkillPrice(uint256 skillId, uint256 newPrice)
        external
        skillExists(skillId)
        onlySkillOwner(skillId)
    {
        require(newPrice > 0, "Price must be > 0");
        skills[skillId].priceA0GI = newPrice;
        emit SkillPriceUpdated(skillId, newPrice);
    }

    /// @notice Developer deactivates skill (prompt is immutable — re-register with new skillId to change)
    function deactivateSkill(uint256 skillId)
        external
        skillExists(skillId)
        onlySkillOwner(skillId)
    {
        skills[skillId].active = false;
        emit SkillDeactivated(skillId);
    }

    /// @notice Owner updates oracle address
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /// @notice Named-field access to avoid brittle struct unpacking in SkillEscrow
    function getSkill(uint256 skillId)
        external
        view
        skillExists(skillId)
        returns (
            uint256 id,
            address developer,
            bytes32 promptHash,
            address computeProvider,
            string memory model,
            uint256 priceA0GI,
            string memory metadata,
            bool active,
            uint256 totalExecutions,
            uint256 successfulExecutions,
            uint256 createdAt
        )
    {
        Skill storage s = skills[skillId];
        return (
            s.skillId,
            s.developer,
            s.promptHash,
            s.computeProvider,
            s.model,
            s.priceA0GI,
            s.metadata,
            s.active,
            s.totalExecutions,
            s.successfulExecutions,
            s.createdAt
        );
    }

    /// @notice Returns (total, successful, successRate 0-100)
    function getReputationScore(uint256 skillId)
        external
        view
        skillExists(skillId)
        returns (uint256 total, uint256 successful, uint256 successRate)
    {
        Skill storage s = skills[skillId];
        total = s.totalExecutions;
        successful = s.successfulExecutions;
        successRate = total == 0 ? 0 : (successful * 100) / total;
    }

    /// @notice Returns all skillIds registered by a developer
    function getDeveloperSkills(address dev) external view returns (uint256[] memory) {
        return developerSkills[dev];
    }
}
