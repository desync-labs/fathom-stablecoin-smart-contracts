// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IAccessControlConfig.sol";

interface IBookKeeper {
    function addCollateral(
        bytes32 _collateralPoolId,
        address _ownerAddress,
        int256 _amount // [wad]
    ) external;

    function movePosition(bytes32 _collateralPoolId, address _src, address _dst, int256 _collateralAmount, int256 _debtShare) external;

    function adjustPosition(
        bytes32 _collateralPoolId,
        address _positionAddress,
        address _collateralOwner,
        address _stablecoinOwner,
        int256 _collateralValue,
        int256 _debtShare
    ) external;

    function totalStablecoinIssued() external returns (uint256);

    function moveStablecoin(
        address _src,
        address _dst,
        uint256 _value // [rad]
    ) external;

    function moveCollateral(
        bytes32 _collateralPoolId,
        address _src,
        address _dst,
        uint256 _amount // [wad]
    ) external;

    function confiscatePosition(
        bytes32 _collateralPoolId,
        address _positionAddress,
        address _collateralCreditor,
        address _stablecoinDebtor,
        int256 _collateralAmount, // [wad]
        int256 _debtShare // [wad]
    ) external;

    function mintUnbackedStablecoin(
        address _from,
        address _to,
        uint256 _value // [rad]
    ) external;

    function accrueStabilityFee(
        bytes32 _collateralPoolId,
        address _stabilityFeeRecipient,
        int256 _debtAccumulatedRate // [ray]
    ) external;

    function settleSystemBadDebt(uint256 _value) external; // [rad]

    function whitelist(address _toBeWhitelistedAddress) external;

    function removeFromWhitelist(address _toBeRemovedAddress) external;

    function handleBridgeOut(uint64 _destChainId, uint256 _amount) external;

    function handleBridgeIn(uint64 _srcChainId, uint256 _amount) external;

    function collateralToken(bytes32 _collateralPoolId, address _ownerAddress) external view returns (uint256);

    function positionWhitelist(address _positionAddress, address _whitelistedAddress) external view returns (uint256);

    function stablecoin(address _ownerAddress) external view returns (uint256);

    function positions(
        bytes32 _collateralPoolId,
        address _positionAddress
    )
        external
        view
        returns (
            uint256 lockedCollateral, // [wad]
            uint256 debtShare // [wad]
        );

    function systemBadDebt(address _ownerAddress) external view returns (uint256); // [rad]

    function poolStablecoinIssued(bytes32 _collateralPoolId) external view returns (uint256); // [rad]

    function collateralPoolConfig() external view returns (address);

    function accessControlConfig() external view returns (address);
}
