// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ILiquidationStrategy {
    function execute(
        bytes32 collateralPoolId,
        uint256 positionDebtShare, // Debt Value                  [rad]
        uint256 positionCollateralAmount, // Collateral Amount           [wad]
        address positionAddress, // Address that will receive any leftover collateral
        uint256 debtShareToBeLiquidated, // The value of debt to be liquidated as specified by the liquidator [wad]
        uint256 maxDebtShareToBeLiquidated, // The maximum value of debt to be liquidated as specified by the liquidator in case of full liquidation for slippage control [rad]
        address _liquidatorAddress,
        address collateralRecipient,
        bytes calldata data
    ) external;
}
