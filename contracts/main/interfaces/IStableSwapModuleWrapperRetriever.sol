// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IStablecoinAdapter.sol";

interface IStableSwapModuleWrapperRetriever {
    function stablecoin() external view returns (address);
    function token() external view returns (address);
    function stableSwapModule() external view returns (address);
    function isDecentralizedState() external view returns (bool);
    function totalValueDeposited() external view returns (uint256);
}
