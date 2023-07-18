// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStablecoin.sol";

interface IStablecoinAdapter {
    function bookKeeper() external returns (IBookKeeper);

    function stablecoin() external returns (IStablecoin);

    function deposit(address positionAddress, uint256 wad, bytes calldata data) external;

    function depositRAD(address positionAddress, uint256 rad, bytes calldata data) external;

    function withdraw(address positionAddress, uint256 wad, bytes calldata data) external;
}
