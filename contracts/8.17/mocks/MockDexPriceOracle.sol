// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;


contract MockDexPriceOracle{
    uint256 mockPrice;

  /// @dev Return the wad price of token0/token1, multiplied by 1e18
  /// NOTE: (if you have 1 token0 how much you can sell it for token1)
  function getPrice(address token0, address token1) external view returns (uint256, uint256) {
    return (mockPrice, uint64(block.timestamp));
  }

  function changPrice(uint256 _mockPrice) external {
      mockPrice = _mockPrice;
  }
}
