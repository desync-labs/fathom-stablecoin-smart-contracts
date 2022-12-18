// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ISystemDebtEngine {
    function settleSystemBadDebt(uint256 value) external; // [rad]

    function surplusBuffer() external view returns (uint256); // [rad]
}
