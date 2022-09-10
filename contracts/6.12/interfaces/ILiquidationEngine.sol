// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface ILiquidationEngine {
    function liquidate(
        bytes32 _collateralPoolId,
        address _positionAddress,
        uint256 _debtShareToBeLiquidated, // [rad]
        uint256 _maxDebtShareToBeLiquidated, // [rad]
        address _collateralRecipient,
        bytes calldata data
    ) external;

    function live() external view returns (uint256);
}
