// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IToken.sol";

interface ICollateralAdapter {
    function deposit(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function withdraw(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function collateralPoolId() external view returns (bytes32);

    function whiteListed(address _whitelistee) external view returns (bool);
}
