// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IManager {
    function open(bytes32, address) external returns (uint256);

    function give(uint256, address) external;

    function allowManagePosition(uint256, address, uint256) external;

    function allowMigratePosition(address, uint256) external;

    function adjustPosition(uint256, int256, int256, bytes calldata) external;

    function moveCollateral(uint256, address, uint256, bytes calldata) external;

    function moveStablecoin(uint256, address, uint256) external;

    function exportPosition(uint256, address) external;

    function importPosition(address, uint256) external;

    function movePosition(uint256, uint256) external;

    function updatePrice(bytes32 _poolId) external;

    function redeemLockedCollateral(uint256 _posId, address _collateralReceiver, bytes calldata _data) external;

    function mapPositionHandlerToOwner(address) external view returns (address);

    function ownerWhitelist(address, uint256, address) external view returns (uint256);

    function collateralPools(uint256) external view returns (bytes32);

    function owners(uint256) external view returns (address);

    function positions(uint256) external view returns (address);

    function bookKeeper() external view returns (address);
}
