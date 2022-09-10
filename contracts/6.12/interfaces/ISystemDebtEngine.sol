// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface ISystemDebtEngine {
    function settleSystemBadDebt(uint256 value) external; // [rad]

    function surplusBuffer() external view returns (uint256); // [rad]
}
