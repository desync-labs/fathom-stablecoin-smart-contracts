// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ILiquidationStrategy {
    function execute(
        bytes32 _collateralPoolId,
        uint256 _positionDebtShare, // Debt Value                  [rad]
        uint256 _positionCollateralAmount, // Collateral Amount           [wad]
        address _positionAddress, // Address that will receive any leftover collateral
        uint256 _debtShareToBeLiquidated, // The value of debt to be liquidated as specified by the liquidator [wad]
        uint256 _maxDebtShareToBeLiquidated, // The maximum value of debt to be liquidated as specified by the liquidator in case of full liquidation for slippage control [rad]
        address _liquidatorAddress,
        address _collateralRecipient,
        bytes calldata _data
    ) external;
}
