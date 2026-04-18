// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {PullPayment}     from "@openzeppelin/contracts/security/PullPayment.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @dev Minimal interface for SkillRegistryV2 — only what the escrow needs.
interface ISkillRegistryV2 {
    struct Skill {
        address developer;
        bytes32 promptHash;
        address computeProvider;
        string  model;
        uint256 priceA0GI;
        string  metadata;
        uint256 executionCount;
        uint256 successfulExecutions;
        uint256 totalRevenueEarned;
        uint64  createdAt;
        bool    active;
        bool    exists;
    }
    function ownerOf(uint256 tokenId) external view returns (address);
    function getSkill(uint256 skillId) external view returns (Skill memory);
    function recordExecution(uint256 skillId, bytes32 receiptHash, bool success, uint256 revenueAdded) external;
}

/// @title SkillEscrowV2
/// @notice Holds native token during execution. Revenue flows to the NFT owner
///         at the time of funding (snapshot), not at confirm time.
///         Uses OpenZeppelin PullPayment — owners call withdrawPayments() to claim.
contract SkillEscrowV2 is PullPayment, ReentrancyGuard {

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant TIMEOUT      = 5 minutes;
    uint16  public constant TREASURY_BPS = 1000; // 10%

    // ─── Immutables ───────────────────────────────────────────────────────────
    ISkillRegistryV2 public immutable registry;
    address payable  public immutable treasury;

    // ─── State ────────────────────────────────────────────────────────────────
    address public oracle;
    address public owner;

    struct Execution {
        bytes32 executionId;
        uint256 skillId;
        address agent;
        bytes32 inputHash;
        uint256 amount;
        address payeeAtFunding;   // NFT owner snapshot at request time
        uint256 createdAt;
        bool    settled;
        bool    refunded;
    }

    mapping(bytes32 => Execution) public executions;
    uint256 public executionNonce;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ExecutionRequested(
        bytes32 indexed executionId,
        uint256 indexed skillId,
        address indexed agent,
        bytes32 inputHash,
        uint256 amount
    );
    event ExecutionConfirmed(
        bytes32 indexed executionId,
        bytes32 receiptHash,
        address payee,
        uint256 payeeAmount,
        uint256 treasuryAmount
    );
    event ExecutionRefunded(
        bytes32 indexed executionId,
        address indexed agent,
        uint256 amount
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        ISkillRegistryV2 _registry,
        address _oracle,
        address payable _treasury
    ) {
        registry = _registry;    // immutable — no rug-pull via setter
        treasury = _treasury;    // immutable
        oracle   = _oracle;
        owner    = msg.sender;
    }

    // ─── Agent: Request Execution ─────────────────────────────────────────────
    /// @notice Agent sends payment and requests skill execution.
    ///         Snapshots the current NFT owner as the revenue recipient.
    function requestExecution(uint256 skillId, bytes32 inputHash)
        external payable nonReentrant
        returns (bytes32 executionId)
    {
        ISkillRegistryV2.Skill memory skill = registry.getSkill(skillId);
        require(skill.active, "Skill is not active");
        require(msg.value >= skill.priceA0GI, "Insufficient payment");

        // Snapshot NFT owner at funding time — KEY anti-front-running measure
        address payee = registry.ownerOf(skillId);

        executionNonce++;
        executionId = keccak256(abi.encodePacked(
            skillId, msg.sender, inputHash, block.timestamp, executionNonce
        ));

        uint256 lockedAmount = skill.priceA0GI;

        executions[executionId] = Execution({
            executionId:    executionId,
            skillId:        skillId,
            agent:          msg.sender,
            inputHash:      inputHash,
            amount:         lockedAmount,
            payeeAtFunding: payee,
            createdAt:      block.timestamp,
            settled:        false,
            refunded:       false
        });

        // Refund overpayment immediately
        if (msg.value > lockedAmount) {
            uint256 excess = msg.value - lockedAmount;
            payable(msg.sender).transfer(excess);
        }

        emit ExecutionRequested(executionId, skillId, msg.sender, inputHash, lockedAmount);
    }

    // ─── Oracle: Confirm Execution ────────────────────────────────────────────
    /// @notice Oracle calls after TEE verification. Revenue split to payeeAtFunding + treasury.
    ///         Uses PullPayment._asyncTransfer — no reentrancy, no griefing.
    function confirmExecution(bytes32 executionId, bytes32 receiptHash)
        external onlyOracle nonReentrant
    {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");
        require(block.timestamp <= exec.createdAt + TIMEOUT, "Execution timed out");

        exec.settled = true;

        // 90/10 split
        uint256 treasuryCut = (exec.amount * TREASURY_BPS) / 10_000;
        uint256 payeeCut    = exec.amount - treasuryCut;

        // PULL payments — funds go to OZ internal Escrow, not directly
        _asyncTransfer(exec.payeeAtFunding, payeeCut);
        _asyncTransfer(treasury, treasuryCut);

        // Record execution + revenue on the NFT
        registry.recordExecution(exec.skillId, receiptHash, true, payeeCut);

        emit ExecutionConfirmed(executionId, receiptHash, exec.payeeAtFunding, payeeCut, treasuryCut);
    }

    // ─── Refund ───────────────────────────────────────────────────────────────
    /// @notice Refund agent if oracle fails or timeout expires.
    function refund(bytes32 executionId) external nonReentrant {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");

        bool callerIsOracle = msg.sender == oracle;
        bool timedOut = block.timestamp > exec.createdAt + TIMEOUT;
        require(callerIsOracle || timedOut, "Cannot refund yet");

        exec.refunded = true;

        // Record failed execution for reputation
        registry.recordExecution(exec.skillId, bytes32(0), false, 0);

        // Push refund to agent (agent is the original sender, safe to push)
        payable(exec.agent).transfer(exec.amount);
        emit ExecutionRefunded(executionId, exec.agent, exec.amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        oracle = newOracle;
    }

    // ─── View ─────────────────────────────────────────────────────────────────
    function getExecution(bytes32 executionId) external view returns (Execution memory) {
        return executions[executionId];
    }
}
