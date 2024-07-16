// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStablecoin.sol";

interface IStablecoinAdapter {
    function bookKeeper() external returns (IBookKeeper);

    function stablecoin() external returns (IStablecoin);

    function deposit(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function depositRAD(address _positionAddress, uint256 _rad, bytes32 _collateralPoolId, bytes calldata _data) external;

    function withdraw(address _positionAddress, uint256 _wad, bytes calldata _data) external;

    function crossChainTransferOut(address _from, uint256 _amount) external;

    function crossChainTransferIn(address _to, uint256 _amount) external;
}
