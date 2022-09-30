// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

interface IERC20 {
  // Information query functions
  function balanceOf(address tokenOwner) external view returns (uint256);
}
