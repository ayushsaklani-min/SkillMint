// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {PullPayment}     from "@openzeppelin/contracts/security/PullPayment.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISkillRegistryV3 {
    struct Skill {
        address developer;
        bytes32 promptHash;
        address computeProvider;
        string  model;
        uint256 priceA0GI;
        uint256 priceUSDC;
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
    function priceFor(uint256 skillId, address paymentToken) external view returns (uint256);
    function recordExecution(uint256 skillId, bytes32 receiptHash, bool success, uint256 revenueAdded) external;
}

/// @title SkillEscrowV3
/// @notice Multi-token escrow: native 0G via PullPayment, ERC-20 (W0G + USDC.E) via push transfer.
contract SkillEscrowV3 is PullPayment, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    uint256 public constant TIMEOUT      = 5 minutes;
    uint16  public constant TREASURY_BPS = 1000; // 10%

    bytes32 public constant ORACLE_ROLE      = keccak256("ORACLE_ROLE");
    bytes32 public constant FACILITATOR_ROLE = keccak256("FACILITATOR_ROLE");

    ISkillRegistryV3 public immutable registry;
    address payable  public           treasury;

    mapping(address => bool)    public supportedTokens;
    mapping(address => uint256) public unallocatedTokenBalance;

    struct Execution {
        bytes32 executionId;
        uint256 skillId;
        address agent;
        bytes32 inputHash;
        uint256 amount;
        address payeeAtFunding;
        uint256 createdAt;
        bool    settled;
        bool    refunded;
        address paymentToken;
    }

    mapping(bytes32 => Execution) public executions;
    uint256 public executionNonce;

    error UnsupportedToken(address token);
    error WrongAmount(uint256 expected, uint256 got);
    error Underfunded(uint256 needed, uint256 available);

    event ExecutionRequested(
        bytes32 indexed executionId,
        uint256 indexed skillId,
        address indexed agent,
        bytes32 inputHash,
        uint256 amount,
        address paymentToken
    );
    event ExecutionConfirmed(
        bytes32 indexed executionId,
        bytes32 receiptHash,
        address payee,
        uint256 payeeAmount,
        uint256 treasuryAmount,
        address paymentToken
    );
    event ExecutionRefunded(
        bytes32 indexed executionId,
        address indexed agent,
        uint256 amount,
        address paymentToken
    );
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);

    constructor(
        ISkillRegistryV3 _registry,
        address _oracle,
        address payable _treasury
    ) {
        registry = _registry;
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _oracle);
    }

    function requestExecution(uint256 skillId, bytes32 inputHash)
        external payable nonReentrant
        returns (bytes32 executionId)
    {
        ISkillRegistryV3.Skill memory skill = registry.getSkill(skillId);
        require(skill.active, "Skill is not active");
        require(msg.value >= skill.priceA0GI, "Insufficient payment");

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
            refunded:       false,
            paymentToken:   address(0)
        });

        if (msg.value > lockedAmount) {
            payable(msg.sender).transfer(msg.value - lockedAmount);
        }

        emit ExecutionRequested(executionId, skillId, msg.sender, inputHash, lockedAmount, address(0));
    }

    function requestExecutionWithToken(
        uint256 skillId,
        bytes32 inputHash,
        address token,
        uint256 amount
    ) external nonReentrant returns (bytes32 executionId) {
        if (!supportedTokens[token]) revert UnsupportedToken(token);

        ISkillRegistryV3.Skill memory skill = registry.getSkill(skillId);
        require(skill.active, "Skill is not active");

        uint256 expected = registry.priceFor(skillId, token);
        if (amount != expected) revert WrongAmount(expected, amount);

        address payee = registry.ownerOf(skillId);
        executionNonce++;
        executionId = keccak256(abi.encodePacked(
            skillId, msg.sender, inputHash, block.timestamp, executionNonce
        ));

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        unallocatedTokenBalance[token] += amount;

        executions[executionId] = Execution({
            executionId:    executionId,
            skillId:        skillId,
            agent:          msg.sender,
            inputHash:      inputHash,
            amount:         amount,
            payeeAtFunding: payee,
            createdAt:      block.timestamp,
            settled:        false,
            refunded:       false,
            paymentToken:   token
        });

        emit ExecutionRequested(executionId, skillId, msg.sender, inputHash, amount, token);
    }

    function requestExecutionPrefunded(
        uint256 skillId,
        bytes32 inputHash,
        address token,
        uint256 amount,
        address agent
    ) external onlyRole(FACILITATOR_ROLE) nonReentrant returns (bytes32 executionId) {
        require(agent != address(0), "agent zero");
        if (!supportedTokens[token]) revert UnsupportedToken(token);

        ISkillRegistryV3.Skill memory skill = registry.getSkill(skillId);
        require(skill.active, "Skill is not active");

        uint256 expected = registry.priceFor(skillId, token);
        if (amount != expected) revert WrongAmount(expected, amount);

        uint256 onHand    = IERC20(token).balanceOf(address(this));
        uint256 available = onHand - unallocatedTokenBalance[token];
        if (available < amount) revert Underfunded(amount, available);

        address payee = registry.ownerOf(skillId);
        executionNonce++;
        executionId = keccak256(abi.encodePacked(
            skillId, agent, inputHash, block.timestamp, executionNonce
        ));

        unallocatedTokenBalance[token] += amount;

        executions[executionId] = Execution({
            executionId:    executionId,
            skillId:        skillId,
            agent:          agent,
            inputHash:      inputHash,
            amount:         amount,
            payeeAtFunding: payee,
            createdAt:      block.timestamp,
            settled:        false,
            refunded:       false,
            paymentToken:   token
        });

        emit ExecutionRequested(executionId, skillId, agent, inputHash, amount, token);
    }

    function confirmExecution(bytes32 executionId, bytes32 receiptHash)
        external onlyRole(ORACLE_ROLE) nonReentrant
    {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");
        require(block.timestamp <= exec.createdAt + TIMEOUT, "Execution timed out");

        exec.settled = true;

        uint256 treasuryCut = (exec.amount * TREASURY_BPS) / 10_000;
        uint256 payeeCut    = exec.amount - treasuryCut;

        if (exec.paymentToken == address(0)) {
            _asyncTransfer(exec.payeeAtFunding, payeeCut);
            _asyncTransfer(treasury, treasuryCut);
        } else {
            unallocatedTokenBalance[exec.paymentToken] -= exec.amount;
            IERC20(exec.paymentToken).safeTransfer(exec.payeeAtFunding, payeeCut);
            IERC20(exec.paymentToken).safeTransfer(treasury, treasuryCut);
        }

        registry.recordExecution(exec.skillId, receiptHash, true, payeeCut);
        emit ExecutionConfirmed(executionId, receiptHash, exec.payeeAtFunding, payeeCut, treasuryCut, exec.paymentToken);
    }

    function refund(bytes32 executionId) external nonReentrant {
        Execution storage exec = executions[executionId];
        require(exec.executionId != bytes32(0), "Execution not found");
        require(!exec.settled, "Already settled");
        require(!exec.refunded, "Already refunded");

        bool callerIsOracle = hasRole(ORACLE_ROLE, msg.sender);
        bool timedOut = block.timestamp > exec.createdAt + TIMEOUT;
        require(callerIsOracle || timedOut, "Cannot refund yet");

        exec.refunded = true;
        registry.recordExecution(exec.skillId, bytes32(0), false, 0);

        if (exec.paymentToken == address(0)) {
            payable(exec.agent).transfer(exec.amount);
        } else {
            unallocatedTokenBalance[exec.paymentToken] -= exec.amount;
            IERC20(exec.paymentToken).safeTransfer(exec.agent, exec.amount);
        }

        emit ExecutionRefunded(executionId, exec.agent, exec.amount, exec.paymentToken);
    }

    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "zero address");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /// @dev Removing a token from the allowlist only blocks NEW requests. In-flight executions
    ///      with this token still settle/refund correctly because confirmExecution and refund
    ///      read paymentToken from the stored Execution struct, not from supportedTokens.
    ///      Do NOT add a supportedTokens re-check on those paths — it would brick stuck funds.
    function removeSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setTreasury(address payable newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "zero address");
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    function getExecution(bytes32 executionId) external view returns (Execution memory) {
        return executions[executionId];
    }
}
