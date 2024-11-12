// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;
import "../StakingStorage.sol";
import "../interfaces/IStakingEvents.sol";
import "../interfaces/IRewardsHandler.sol";

contract RewardsInternals is StakingStorage, IStakingEvents {
    // solhint-disable not-rely-on-time

    error InactiveStreamError();
    error NoStakeError();
    error InsufficientRewardsError();
    error NoLockError();
    error NoSharesError();
    error ClaimingOfRewardsUnfeasibleForLockWithoutEarlyWithdraw();

    function _updateStreamsRewardsSchedules(uint256 streamId, uint256 rewardTokenAmount) internal {
        uint256 streamScheduleRewardLength = streams[streamId].schedule.reward.length;
        for (uint256 i; i < streamScheduleRewardLength; i++) {
            streams[streamId].schedule.reward[i] = (streams[streamId].schedule.reward[i] * rewardTokenAmount) / streams[streamId].maxDepositAmount;
        }
    }

    function _moveRewardsToPending(address account, uint256 streamId, uint256 lockId) internal {
        if (streams[streamId].status != StreamStatus.ACTIVE) {
            revert InactiveStreamError();
        }
        LockedBalance storage lock = locks[account][lockId - 1];

        if (prohibitedEarlyWithdraw[account][lockId] && lock.end > block.timestamp) {
            return;
        }

        if (lock.amountOfToken == 0) {
            revert NoStakeError();
        }

        User storage userAccount = users[account];

        uint256 reward = ((streams[streamId].rps - userAccount.rpsDuringLastClaimForLock[lockId][streamId]) * lock.positionStreamShares) /
            RPS_MULTIPLIER;
        if (reward == 0) return; // All rewards claimed or stream schedule didn't start
        if (streams[streamId].rewardClaimedAmount + reward > streams[streamId].rewardDepositAmount) {
            revert InsufficientRewardsError();
        }

        userAccount.pendings[streamId] += reward;
        streamTotalUserPendings[streamId] += reward;
        userAccount.rpsDuringLastClaimForLock[lockId][streamId] = streams[streamId].rps;
        userAccount.releaseTime[streamId] = block.timestamp + streams[streamId].tau;
        // If the stream is blocklisted, remaining unclaimed rewards will be transfered out.
        streams[streamId].rewardClaimedAmount += reward;
        emit Pending(streamId, account, userAccount.pendings[streamId]);
    }

    function _moveAllStreamRewardsToPending(address account, uint256 lockId) internal {
        uint256 streamsLength = streams.length;
        for (uint256 i; i < streamsLength; i++) {
            if (streams[i].status == StreamStatus.ACTIVE) _moveRewardsToPending(account, i, lockId);
        }
    }

    function _moveAllLockPositionRewardsToPending(address account, uint256 streamId) internal {
        if (streams[streamId].status != StreamStatus.ACTIVE) {
            revert InactiveStreamError();
        }
        LockedBalance[] storage locksOfAccount = locks[account];
        uint256 locksLength = locksOfAccount.length;
        if (locksLength == 0) {
            revert NoLockError();
        }
        for (uint256 i = 1; i <= locksLength; i++) {
            _moveRewardsToPending(account, streamId, i);
        }
    }

    function _updateStreamRPS() internal {
        if (touchedAt == block.timestamp) return; // Already updated by previous transaction
        if (totalAmountOfStakedToken != 0) {
            for (uint256 i; i < streams.length; i++) {
                if (streams[i].status == StreamStatus.ACTIVE) {
                    streams[i].rps = _getLatestRewardsPerShare(i);
                }
            }
        }
        touchedAt = block.timestamp;
    }

    function _validateStreamParameters(
        address streamOwner,
        address rewardToken,
        uint256 percentToTreasury,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] memory scheduleTimes,
        uint256[] memory scheduleRewards,
        uint256 tau
    ) internal view {
        IRewardsHandler(rewardsCalculator).validateStreamParameters(
            streamOwner,
            rewardToken,
            percentToTreasury,
            maxDepositAmount,
            minDepositAmount,
            scheduleTimes,
            scheduleRewards,
            tau
        );
    }

    function _getRewardsAmount(uint256 streamId, uint256 lastUpdate) internal view returns (uint256) {
        return IRewardsHandler(rewardsCalculator).getRewardsAmount(streams[streamId].schedule, lastUpdate);
    }

    function _getLatestRewardsPerShare(uint256 streamId) internal view returns (uint256) {
        if (totalStreamShares == 0) {
            revert NoSharesError();
        }
        return streams[streamId].rps + (_getRewardsAmount(streamId, touchedAt) * RPS_MULTIPLIER) / totalStreamShares;
    }
}
