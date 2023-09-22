// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IToken.sol";

interface ICollateralAdapter {
    function deposit(address positionAddress, uint256 wad, bytes calldata data) external;

    function withdraw(address positionAddress, uint256 wad, bytes calldata data) external;

    function collateralPoolId() external view returns (bytes32);
}
