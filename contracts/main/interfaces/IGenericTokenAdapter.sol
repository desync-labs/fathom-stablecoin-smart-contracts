// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IToken.sol";

interface IGenericTokenAdapter {
    function decimals() external returns (uint256);

    function deposit(address positionAddress, uint256 wad, bytes calldata data) external payable;

    function withdraw(address positionAddress, uint256 wad, bytes calldata data) external;

    function onAdjustPosition(address src, address dst, int256 collateralValue, int256 debtShare, bytes calldata data) external;

    function onMoveCollateral(address src, address dst, uint256 wad, bytes calldata data) external;

    function collateralPoolId() external view returns (bytes32);

    function collateralToken() external returns (address);
}
