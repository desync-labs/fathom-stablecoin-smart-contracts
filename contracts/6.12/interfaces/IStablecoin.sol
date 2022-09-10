// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "./IToken.sol";

interface IStablecoin is IToken {
    function mint(address, uint256) external;

    function burn(address, uint256) external;
}
