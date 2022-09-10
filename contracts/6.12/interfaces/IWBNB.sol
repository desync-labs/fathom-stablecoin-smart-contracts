// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface IWBNB {
    function deposit() external payable;

    function withdraw(uint256) external;
}
