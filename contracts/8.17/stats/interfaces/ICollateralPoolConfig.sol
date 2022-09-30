// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

interface ICollateralPoolConfig {
  // Information query functions
  function getLiquidationRatio(bytes32 _collateralPoolId) external view returns (uint256);

  function getStabilityFeeRate(bytes32 _collateralPoolId) external view returns (uint256);

  function getCloseFactorBps(bytes32 _collateralPoolId) external view returns (uint256);

  function getLiquidatorIncentiveBps(bytes32 _collateralPoolId) external view returns (uint256);

}
