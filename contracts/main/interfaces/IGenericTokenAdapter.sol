// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IGenericTokenAdapter {
    function decimals() external returns (uint256);

    function deposit(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function withdraw(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function emergencyWithdraw(address _to) external;

    function collateralToken() external returns (address);

    function collateralPoolId() external view returns (bytes32);
}
