// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20}       from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {EIP712}      from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}       from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title W0G — Wrapped 0G (testnet)
/// @notice ERC-20 wrapper for native A0GI. Adds EIP-3009 `transferWithAuthorization`
///         so agents can sign gasless W0G transfers that skill facilitators settle.
/// @dev    Mirrors the interface of canonical mainnet W0G
///         (0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c) for behavioural parity.
///         EIP-3009 mixin is inlined (OZ does not ship one).
contract W0G is ERC20, ERC20Permit {

    // ─── EIP-3009 ─────────────────────────────────────────────────────────────
    // keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;

    // keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    // keccak256("CancelAuthorization(address authorizer,bytes32 nonce)")
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    /// @dev authorizer => nonce => used
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    // ─── Wrap / Unwrap ────────────────────────────────────────────────────────
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    constructor() ERC20("Wrapped 0G", "W0G") ERC20Permit("Wrapped 0G") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        (bool ok, ) = payable(msg.sender).call{value: wad}("");
        require(ok, "W0G: withdraw failed");
        emit Withdrawal(msg.sender, wad);
    }

    // ─── EIP-3009: authorization state ────────────────────────────────────────
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    // ─── EIP-3009: transferWithAuthorization ──────────────────────────────────
    /// @notice Execute a transfer with a signed authorization.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter,  "W0G: auth not yet valid");
        require(block.timestamp < validBefore, "W0G: auth expired");
        require(!_authorizationStates[from][nonce], "W0G: auth used");

        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from, to, value, validAfter, validBefore, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == from, "W0G: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    // ─── EIP-3009: receiveWithAuthorization ───────────────────────────────────
    /// @notice Same as transferWithAuthorization, but only the recipient can submit.
    ///         Prevents front-running an authorization intended for a specific spender.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(to == msg.sender, "W0G: caller must be payee");
        require(block.timestamp > validAfter,  "W0G: auth not yet valid");
        require(block.timestamp < validBefore, "W0G: auth expired");
        require(!_authorizationStates[from][nonce], "W0G: auth used");

        bytes32 structHash = keccak256(abi.encode(
            RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
            from, to, value, validAfter, validBefore, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == from, "W0G: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    // ─── EIP-3009: cancelAuthorization ────────────────────────────────────────
    /// @notice Burn a not-yet-used authorization nonce.
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(!_authorizationStates[authorizer][nonce], "W0G: auth used");
        bytes32 structHash = keccak256(abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == authorizer, "W0G: invalid signature");

        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }
}
