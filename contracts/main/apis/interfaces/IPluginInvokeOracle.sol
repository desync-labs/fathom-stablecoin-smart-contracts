// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPluginInvokeOracle {
    function showPrice() external view returns (uint256);
    function latestTimestamp() external view returns (uint256);
}
