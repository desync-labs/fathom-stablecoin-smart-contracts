// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IFathomDEXPair {
  /// @dev Return the wad price of token0/token1, multiplied by 1e18
  /// NOTE: (if you have 1 token0 how much you can sell it for token1)
  function getPair(address token0, address token1) external returns (address);
}
