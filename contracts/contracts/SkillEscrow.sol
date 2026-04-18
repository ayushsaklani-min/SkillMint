// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface ISkillRegistry {
    function getSkill(uint256 skillId) external view returns (
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
    );
    function recordExecution(uint256 skillId, bytes32 receiptHash, bool success) external;
}

/// @title SkillEscrow
/// @notice Holds A0GI during execution. Oracle confirms or refunds. 90/10 split on success.
contract SkillEscrow {
    // ─── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant TIMEOUT = 5 minutes;
    uint256 public constant DEVELOPER_BPS = 9000; // 90%
    uint256 public constant TREASURY_BPS  = 1000; // 10%

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct Execution {
        bytes32 executionId;
        uint256 skillId;
        address agent;
        bytes32 inputHash;
        uint256 amount;       // A0GI paid
        uint256 createdAt;
        bool    settled;
        bool    refunded;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    ISkillRegistry public registry;
    address public oracle;
    address public treasury;
    address public owner;

    mapping(bytes32 => Execution) public executions;
    mapping(address => uint256) public developerBalances; // pull-over-push

    uint256 public executionNonce;

    // ─── Events ────────────────────────────────────────────────────────────────

    event ExecutionRequested(bytes32 indexed executionId, uint256 indexed skillId, address indexed agent, bytes32 inputHash, uint256 amount);
    event ExecutionConfirmed(bytes32 indexed executionId, bytes32 receiptHash, uint256 developerAmount, uint256 treasuryAmount);
    event ExecutionRefunded(bytes32 indexed executionId, address indexed agent, uint256 amount);
    event RevenueWithdrawn(address indexed developer, uint256 amount);

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _registry, address _oracle, address _treasury) {
        registry = ISkillRegistry(_registry);
        oracle   = _oracle;
        treasury = _treasury;
        owner    = msg.sender;
    }

    // ─── Agent: Request Execution ──────────────────────────────────────────────

    /// @notice Agent sends A0GI and requests skill execution
    /// @param skillId   on-chain skill id
    /// @param inputHash keccak256 of agent's input JSON
    function requestExecution(uint256 skillId, bytes32 inputHash)
        external
        payable
        returns (bytes32 executionId)
    {
        // Use named field access via getSkill()
        uint256 price;
        bool active;
        {
            (,,,,, uint256 _p, , bool _a,,,) = registry.getSkill(skillId);
            price = _p;
            active = _a;
        }

        require(active, "Skill is not active");
        require(msg.value >= price, "Insufficient payment");

        executionNonce++;
        executionId = keccak256(abi.encodePacked(skillId, msg.sender, inputHash, block.timestamp, executionNonce));

        executions[executionId] = Execution({
            executionId: executionId,
            skillId:     skillId,
            agent:       msg.sender,
            inputHash:   inputHash,
            amount:      msg.value,
            createdAt:   block.timestamp,
            settled:     false,
            refunded:    false
        });

        // Refund overpayment
        if (msg.value > price) {
            uint256 excess = msg.value - price;
            executions[executionId].amount = price;
            payable(msg.sender).transfer(excess);
        }

        emit ExecutionRequested(executionId, skillId, msg.sender, inputHash, executions[executionId].amount);
    }

    // ─── Oracle: Confirm Execution ─────────────────────────────────────────────

    /// @notice Oracle calls after TEE verification succeeds
    /// @param executionId  returned from requestExecution
    /// @param receiptHash  rootHash of receipt JSON uploaded to 0G Storage
    function confirmExecution(bytes32 executionId, bytes32 receiptHash)
        external
        onlyOracle
    {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");
        require(block.timestamp <= exec.createdAt + TIMEOUT, "Execution timed out");

        exec.settled = true;

        // Split 90/10
        uint256 developerAmount = (exec.amount * DEVELOPER_BPS) / 10000;
        uint256 treasuryAmount  = exec.amount - developerAmount;

        // Get developer address via named field access
        address developer;
        {
            (, address _dev,,,,,,,,,) = registry.getSkill(exec.skillId);
            developer = _dev;
        }

        // Pull-over-push: accumulate balance, developer claims separately
        developerBalances[developer] += developerAmount;
        payable(treasury).transfer(treasuryAmount);

        // Update reputation
        registry.recordExecution(exec.skillId, receiptHash, true);

        emit ExecutionConfirmed(executionId, receiptHash, developerAmount, treasuryAmount);
    }

    // ─── Oracle / Auto: Refund ─────────────────────────────────────────────────

    /// @notice Refund agent if execution times out or fails
    function refund(bytes32 executionId) external {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");

        bool callerIsOracle = msg.sender == oracle;
        bool timedOut = block.timestamp > exec.createdAt + TIMEOUT;
        require(callerIsOracle || timedOut, "Cannot refund yet");

        exec.refunded = true;

        // Record failed execution for reputation
        registry.recordExecution(exec.skillId, bytes32(0), false);

        payable(exec.agent).transfer(exec.amount);
        emit ExecutionRefunded(executionId, exec.agent, exec.amount);
    }

    // ─── Developer: Claim Revenue ──────────────────────────────────────────────

    /// @notice Developer pulls accumulated earnings (pull-over-push pattern)
    function claimRevenue() external {
        uint256 amount = developerBalances[msg.sender];
        require(amount > 0, "No balance");
        developerBalances[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit RevenueWithdrawn(msg.sender, amount);
    }

    // ─── Owner ─────────────────────────────────────────────────────────────────

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        oracle = newOracle;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    // ─── View ──────────────────────────────────────────────────────────────────

    function getExecution(bytes32 executionId) external view returns (Execution memory) {
        return executions[executionId];
    }
}
