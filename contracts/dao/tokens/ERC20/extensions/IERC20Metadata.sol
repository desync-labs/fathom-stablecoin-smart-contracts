// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts v4.4.1 (token/ERC20/extensions/IERC20Metadata.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../IERC20.sol";

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);
}
