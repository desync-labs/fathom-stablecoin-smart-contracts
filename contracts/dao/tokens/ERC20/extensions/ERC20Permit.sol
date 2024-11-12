// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/extensions/ERC20Permit.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./IERC20Permit.sol";
import "../ERC20.sol";
import "../../../../common/cryptography/EIP712.sol";
import "../../../../common/cryptography/ECDSA.sol";
import "../../../../common/structs/Counters.sol";

abstract contract ERC20Permit is ERC20, IERC20Permit, EIP712 {
    using Counters for Counters.Counter;

    mapping(address => Counters.Counter) private _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private _PERMIT_TYPEHASH_DEPRECATED_SLOT;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private constant _PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    error ExpiredDeadline();
    error InvalidSignature();

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) EIP712(name_, "1") {}

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external virtual override {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > deadline) {
            revert ExpiredDeadline();
        }

        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        if (signer != owner) {
            revert InvalidSignature();
        }

        _approve(owner, spender, value);
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    function nonces(address owner) external view virtual override returns (uint256) {
        return _nonces[owner].current();
    }

    function _useNonce(address owner) internal virtual returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }
}
