// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022
pragma solidity 0.6.12;

import "../interfaces/IAuthTokenAdapter.sol";
import "../interfaces/IStablecoinAdapter.sol";

interface IStableSwapModule {
    function swapTokenToStablecoin(address usr, uint256 tokenAmount) external;

    function swapStablecoinToToken(address usr, uint256 tokenAmount) external;

    function authTokenAdapter() external view returns (IAuthTokenAdapter);

    function stablecoinAdapter() external view returns (IStablecoinAdapter);
}
