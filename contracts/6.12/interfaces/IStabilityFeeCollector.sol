// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface IStabilityFeeCollector {
    function collect(bytes32 collateralPoolId) external returns (uint256 debtAccumulatedRate); // [ray]
}
