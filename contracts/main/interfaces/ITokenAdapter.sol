// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IToken.sol";

interface ITokenAdapter {
    function decimals() external returns (uint256);

    function collateralToken() external returns (IToken);

    function deposit(address, uint256) external payable;

    function withdraw(address, uint256) external;
}
