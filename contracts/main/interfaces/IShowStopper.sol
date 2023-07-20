// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IGenericTokenAdapter.sol";

interface IShowStopper {
    function redeemLockedCollateral(
        bytes32 collateralPoolId,
        address positionAddress,
        address collateralReceiver,
        bytes calldata data
    ) external;

    function live() external view returns (uint256);
}
