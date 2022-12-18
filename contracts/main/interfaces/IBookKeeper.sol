// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IAccessControlConfig.sol";

interface IBookKeeper {
    function collateralToken(bytes32 collateralPoolId, address ownerAddress) external view returns (uint256);

    function addCollateral(
        bytes32 collateralPoolId,
        address ownerAddress,
        int256 amount // [wad]
    ) external;

    function movePosition(bytes32 collateralPoolId, address src, address dst, int256 collateralAmount, int256 debtShare) external;

    function positionWhitelist(address positionAddress, address whitelistedAddress) external view returns (uint256);

    function adjustPosition(
        bytes32 collateralPoolId,
        address positionAddress,
        address collateralOwner,
        address stablecoinOwner,
        int256 collateralValue,
        int256 debtShare
    ) external;

    function stablecoin(address ownerAddress) external view returns (uint256);

    function positions(
        bytes32 collateralPoolId,
        address positionAddress
    )
        external
        view
        returns (
            uint256 lockedCollateral, // [wad]
            uint256 debtShare // [wad]
        );

    function totalStablecoinIssued() external returns (uint256);

    function moveStablecoin(
        address src,
        address dst,
        uint256 value // [rad]
    ) external;

    function moveCollateral(
        bytes32 collateralPoolId,
        address src,
        address dst,
        uint256 amount // [wad]
    ) external;

    function confiscatePosition(
        bytes32 collateralPoolId,
        address positionAddress,
        address collateralCreditor,
        address stablecoinDebtor,
        int256 collateralAmount, // [wad]
        int256 debtShare // [wad]
    ) external;

    function mintUnbackedStablecoin(
        address from,
        address to,
        uint256 value // [rad]
    ) external;

    function accrueStabilityFee(
        bytes32 collateralPoolId,
        address stabilityFeeRecipient,
        int256 debtAccumulatedRate // [ray]
    ) external;

    function systemBadDebt(address ownerAddress) external view returns (uint256); // [rad]

    function settleSystemBadDebt(uint256 value) external; // [rad]

    function poolStablecoinIssued(bytes32 collateralPoolId) external view returns (uint256); // [rad]

    function whitelist(address toBeWhitelistedAddress) external;

    function blacklist(address toBeBlacklistedAddress) external;

    function collateralPoolConfig() external view returns (address);

    function accessControlConfig() external view returns (address);
}
