// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../StakingStructs.sol";

interface IRewardsHandler {
    function validateStreamParameters(
        address streamOwner,
        address rewardToken,
        uint256 percentToTreasury,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] calldata scheduleTimes,
        uint256[] calldata scheduleRewards,
        uint256 tau
    ) external view;

    function getRewardsAmount(Schedule calldata schedule, uint256 lastUpdate) external view returns (uint256);
}
