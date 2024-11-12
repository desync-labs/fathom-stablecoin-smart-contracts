// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../StakingStructs.sol";

interface IStakingGetter {
    function getAllLocks(address account) external view returns (LockedBalance[] memory);

    function getUsersPendingRewards(address account, uint256 streamId) external view returns (uint256);

    function getStreamClaimableAmountPerLock(uint256 streamId, address account, uint256 lockId) external view returns (uint256);

    function getStreamSchedule(uint256 streamId) external view returns (uint256[] memory scheduleTimes, uint256[] memory scheduleRewards);

    function getStream(
        uint256 streamId
    ) external view returns (uint256 rewardDepositAmount, uint256 rewardClaimedAmount, uint256 rps, StreamStatus status);

    function isProhibitedLockPosition(uint256 lockId, address account) external view returns (bool);
}
