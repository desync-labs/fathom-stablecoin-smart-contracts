// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IAuthTokenAdapter.sol";
import "../interfaces/IStablecoinAdapter.sol";

interface IStableSwapModule {
    function swapTokenToStablecoin(address usr, uint256 tokenAmount) external;

    function swapStablecoinToToken(address usr, uint256 tokenAmount) external;

    function authTokenAdapter() external view returns (IAuthTokenAdapter);

    function stablecoinAdapter() external view returns (IStablecoinAdapter);
}
