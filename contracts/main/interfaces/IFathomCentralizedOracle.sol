// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFathomCentralizedOracle {
    function getPrice() external view returns (uint256 price, uint256 lastUpdate);
}
