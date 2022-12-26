// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFathomDEXOracle {
    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1) external returns (uint256 price, uint256 lastUpdate);
}
