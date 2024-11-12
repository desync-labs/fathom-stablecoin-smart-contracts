// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts v4.4.1 (token/ERC20/extensions/IERC20Permit.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IERC20Permit {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

    function nonces(address owner) external view returns (uint256);

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
