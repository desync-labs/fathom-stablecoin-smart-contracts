// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022
pragma solidity 0.8.17;
import "../StakingStructs.sol";
import "../interfaces/IRewardsHandler.sol";
import "../../../common/math/FullMath.sol";

// solhint-disable not-rely-on-time
contract RewardsCalculator is IRewardsHandler {
    uint256 public constant MAXIMUM_PERCENT_TO_TREASURY = 10000; // equal to denominator
    error BadOwnerError();
    error BadRewardTokenError();
    error NoMinDepositError();
    error BadMinDepositError();
    error InvalidMaxDepositError();
    error BadExpirationError();
    error BadSchedulesLengthError();
    error SchedulesShortError();
    error BadTauError();
    error BadTimesError();
    error BadRewardsError();
    error BadEndRewardsError();
    error BadLastUpdateError();
    error BadSchedulesError();
    error BadQueryPeriodError();
    error QueryBeforeStartError();
    error QueryAfterEndError();
    error InvalidIndexError();
    error BadPercentToTreasuryError();

    // solhint-disable code-complexity
    function validateStreamParameters(
        address streamOwner,
        address rewardToken,
        uint256 percentToTreasury,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] calldata scheduleTimes,
        uint256[] calldata scheduleRewards,
        uint256 tau
    ) external view override {
        if (streamOwner == address(0)) {
            revert BadOwnerError();
        }
        if (rewardToken == address(0)) {
            revert BadRewardTokenError();
        }
        if (minDepositAmount == 0) {
            revert NoMinDepositError();
        }
        if (minDepositAmount > maxDepositAmount) {
            revert BadMinDepositError();
        }
        if (maxDepositAmount != scheduleRewards[0]) {
            revert InvalidMaxDepositError();
        }
        if (scheduleTimes[0] <= block.timestamp) {
            revert BadExpirationError();
        }
        if (scheduleTimes.length != scheduleRewards.length) {
            revert BadSchedulesLengthError();
        }
        if (scheduleTimes.length < 2) {
            revert SchedulesShortError();
        }
        if (tau == 0) {
            revert BadTauError();
        }
        if (percentToTreasury > MAXIMUM_PERCENT_TO_TREASURY) {
            revert BadPercentToTreasuryError();
        }
        for (uint256 i = 1; i < scheduleTimes.length; i++) {
            if (scheduleTimes[i] <= scheduleTimes[i - 1]) {
                revert BadTimesError();
            }
            if (scheduleRewards[i] > scheduleRewards[i - 1]) {
                revert BadRewardsError();
            }
        }
        if (scheduleRewards[scheduleRewards.length - 1] > 0) {
            revert BadEndRewardsError();
        }
    }

    // solhint-enable code-complexity

    function getRewardsAmount(Schedule calldata schedule, uint256 lastUpdate) external view override returns (uint256) {
        if (lastUpdate > block.timestamp) {
            revert BadLastUpdateError();
        }
        if (lastUpdate == block.timestamp) return 0; // No more rewards since last update
        uint256 streamStart = schedule.time[0];
        if (block.timestamp <= streamStart) return 0; // Stream didn't start
        uint256 streamEnd = schedule.time[schedule.time.length - 1];
        if (lastUpdate >= streamEnd) return 0; // Stream schedule ended, all rewards released
        uint256 start;
        uint256 end;
        if (lastUpdate > streamStart) {
            start = lastUpdate;
        } else {
            // Release rewards from stream start.
            start = streamStart;
        }
        if (block.timestamp < streamEnd) {
            end = block.timestamp;
        } else {
            // The stream already finished between the last update and now.
            end = streamEnd;
        }
        return _getRewardsSchedule(schedule, start, end);
    }

    function _getRewardsSchedule(Schedule memory schedule, uint256 start, uint256 end) internal pure returns (uint256) {
        uint256 startIndex;
        uint256 endIndex;
        (startIndex, endIndex) = _getStartEndScheduleIndex(schedule, start, end);
        uint256 rewardScheduledAmount = 0;
        uint256 reward = 0;
        if (startIndex == endIndex) {
            // start and end are within the same schedule period
            reward = schedule.reward[startIndex] - schedule.reward[startIndex + 1];
            rewardScheduledAmount = FullMath.mulDiv(reward, (end - start), (schedule.time[startIndex + 1] - schedule.time[startIndex]));
        } else {
            // start and end are not within the same schedule period
            // Reward during the startIndex period
            // Here reward = starting from the actual start time, calculated for the first schedule period
            // that the rewards start.
            reward = schedule.reward[startIndex] - schedule.reward[startIndex + 1];
            rewardScheduledAmount = FullMath.mulDiv(
                reward,
                (schedule.time[startIndex + 1] - start),
                (schedule.time[startIndex + 1] - schedule.time[startIndex])
            );
            // Here reward = from end of start schedule till beginning of end schedule
            // Reward during the period from startIndex + 1  to endIndex
            rewardScheduledAmount += schedule.reward[startIndex + 1] - schedule.reward[endIndex];
            // Reward at the end schedule where schedule.time[endIndex] '
            reward = schedule.reward[endIndex] - schedule.reward[endIndex + 1];
            rewardScheduledAmount += FullMath.mulDiv(
                reward,
                (end - schedule.time[endIndex]),
                (schedule.time[endIndex + 1] - schedule.time[endIndex])
            );
        }
        return rewardScheduledAmount;
    }

    // solhint-disable code-complexity
    function _getStartEndScheduleIndex(
        Schedule memory schedule,
        uint256 start,
        uint256 end
    ) internal pure returns (uint256 startIndex, uint256 endIndex) {
        uint256 scheduleTimeLength = schedule.time.length;
        if (scheduleTimeLength < 2) {
            revert BadSchedulesError();
        }
        if (end <= start) {
            revert BadQueryPeriodError();
        }
        if (start < schedule.time[0]) {
            revert QueryBeforeStartError();
        }
        if (end > schedule.time[scheduleTimeLength - 1]) {
            revert QueryAfterEndError();
        }
        for (uint256 i = 1; i < scheduleTimeLength; i++) {
            if (start < schedule.time[i]) {
                startIndex = i - 1;
                break;
            }
        }
        if (end == schedule.time[scheduleTimeLength - 1]) {
            endIndex = scheduleTimeLength - 2;
        } else {
            for (uint256 i = startIndex + 1; i < scheduleTimeLength; i++) {
                if (end < schedule.time[i]) {
                    // Users most often claim rewards within the same index which can last several months.
                    endIndex = i - 1;
                    break;
                }
            }
        }
        if (startIndex > endIndex) {
            revert InvalidIndexError();
        }
    }
    // solhint-enable code-complexity
}
