// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface IProxyRegistry {
    function proxies(address) external view returns (address);

    function build(address) external returns (address);
}
