// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IShowStopper {
    function redeemLockedCollateral(bytes32 _collateralPoolId, address _positionAddress, address _collateralReceiver, bytes calldata _data) external;

    function live() external view returns (uint256);
}
