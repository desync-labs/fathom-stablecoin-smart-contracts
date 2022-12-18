// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IToken.sol";

interface IAuthTokenAdapter {
    function bookKeeper() external returns (IBookKeeper);

    function collateralPoolId() external returns (bytes32);

    function decimals() external returns (uint256);

    function deposit(address, uint256, address) external;

    function withdraw(address, uint256) external;

    function token() external returns (IToken);
}
