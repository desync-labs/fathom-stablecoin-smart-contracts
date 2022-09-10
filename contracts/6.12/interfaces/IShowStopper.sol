// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IGenericTokenAdapter.sol";

interface IShowStopper {
    function redeemLockedCollateral(
        bytes32 collateralPoolId,
        IGenericTokenAdapter adapter,
        address positionAddress,
        address collateralReceiver,
        bytes calldata data
    ) external;

    function live() external view returns (uint256);
}
