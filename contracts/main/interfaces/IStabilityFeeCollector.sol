// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IStabilityFeeCollector {
    function collect(bytes32 collateralPoolId) external returns (uint256 debtAccumulatedRate); // [ray]
}
