// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

interface IDEXPriceOracle {
  // Information query functions
  function getPrice(address token0, address token1) external view returns (uint256, uint256);
}
