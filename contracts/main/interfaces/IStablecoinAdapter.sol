// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { IBookKeeper } from "./IBookKeeper.sol";
import { IStablecoin } from "./IStablecoin.sol";

interface IStablecoinAdapter {
    function bookKeeper() external returns (IBookKeeper);

    function stablecoin() external returns (IStablecoin);

    function deposit(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function depositRAD(address _positionAddress, uint256 _rad, bytes32 _collateralPoolId, bytes calldata _data) external;

    function withdraw(address _positionAddress, uint256 _wad, bytes calldata _data) external;
}
