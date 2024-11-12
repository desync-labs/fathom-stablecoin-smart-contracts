// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./RewardsInternals.sol";
import "../interfaces/IStakingEvents.sol";
import "../vault/interfaces/IVault.sol";
import "../../tokens/ERC20/IERC20.sol";
import "../../tokens/IVMainToken.sol";
import "../../../common/math/BoringMath.sol";
import "../../../common/math/FullMath.sol";

contract StakingInternals is RewardsInternals {
    // solhint-disable not-rely-on-time
    error ZeroAddress();
    error ZeroLocked(uint256 lockId);
    error ZeroTotalStakedToken();
    error InvalidShareWeights();
    error InvalidPenaltyWeights();
    error IncorrectWeight();
    error ZeroCoefficient();

    function _initializeStaking(
        address _mainToken,
        address _voteToken,
        address _treasury,
        Weight memory _weight,
        address _vault,
        uint256 _maxLockPositions,
        uint256 _voteShareCoef,
        uint256 _voteLockCoef
    ) internal {
        _verifyStaking(_mainToken, _voteToken, _treasury, _weight, _vault, _voteLockCoef);
        mainToken = _mainToken;
        voteToken = _voteToken;
        treasury = _treasury;
        weight = _weight;
        vault = _vault;
        maxLockPositions = _maxLockPositions;
        voteShareCoef = _voteShareCoef;
        voteLockCoef = _voteLockCoef;
    }

    function _lock(address account, uint256 amount, uint256 lockPeriod) internal {
        uint256 nVoteToken;
        User storage userAccount = users[account];
        if (lockPeriod > 0) {
            nVoteToken = (amount * lockPeriod * POINT_MULTIPLIER) / voteLockCoef / POINT_MULTIPLIER; //maxVoteTokens;
            userAccount.voteTokenBalance += nVoteToken;
            totalAmountOfVoteToken += nVoteToken;
        }
        LockedBalance memory _newLock = LockedBalance({
            amountOfToken: BoringMath.to128(amount),
            amountOfVoteToken: nVoteToken,
            positionStreamShares: 0,
            end: BoringMath.to64(lockPeriod + block.timestamp),
            owner: account
        });
        locks[account].push(_newLock);

        _stake(account, amount, nVoteToken, locks[account].length);
        if (nVoteToken > 0) {
            IVMainToken(voteToken).mint(account, nVoteToken);
        }
    }

    /**
     * @dev Unlocks the lockId position and unstakes it from staking pool
     * @dev Updates Governance weights after unlocking
     * WARNING: rewards are not claimed during unlock.
       The UI must make sure to claim rewards before unstaking.
       Unclaimed rewards will be lost.
      `_updateStreamRPS()` must be called before `_unlock` to update streams rps
     * @notice lockId is index + 1 of array of Locked Balance
     * @notice If the lock position is completely unlocked then the last lock is swapped with current locked
     * and last lock is popped off.
     */
    function _unlock(uint256 stakeValue, uint256 amount, uint256 lockId, address account) internal {
        User storage userAccount = users[account];
        LockedBalance storage updateLock = locks[account][lockId - 1];

        if (totalAmountOfStakedToken == 0) {
            revert ZeroTotalStakedToken();
        }

        uint256 nVoteToken = updateLock.amountOfVoteToken;
        /// if you unstake, early or partial or complete,
        /// the number of vote tokens for lock position is set to zero
        updateLock.amountOfVoteToken = 0;
        totalAmountOfVoteToken -= nVoteToken;
        uint256 remainingVoteTokenBalance = 0;

        //this check to not overflow:
        if (userAccount.voteTokenBalance > nVoteToken) {
            remainingVoteTokenBalance = userAccount.voteTokenBalance - nVoteToken;
        }
        userAccount.voteTokenBalance = remainingVoteTokenBalance;
        _unstake(amount, stakeValue, lockId, account);
        // This is for dust mitigation, so that even if the
        // user does not have enough voteToken, it is still able to burn and unlock
        // takes a bit of gas
        uint256 balance = IERC20(voteToken).balanceOf(account);
        if (balance < nVoteToken) {
            nVoteToken = balance;
        }
        IVMainToken(voteToken).burn(account, nVoteToken);
    }

    /**
     * @dev Stakes the whole lock position and calculates Stream Shares and Main Token Shares
            for the lock position to distribute rewards based on it
     * @notice autocompounding feature is implemented through amountOfMainTokenShares
     * @notice the amount of stream shares you receive decreases from 100% to 25%
     * @notice the amount of stream shares you receive depends upon when in the timeline you have staked
     */
    function _stake(address account, uint256 amount, uint256 nVoteToken, uint256 lockId) internal {
        User storage userAccount = users[account];
        LockedBalance storage lock = locks[account][lockId - 1];

        totalAmountOfStakedToken += amount;
        uint256 weightedAmountOfSharesPerStream = _weightedShares(amount, nVoteToken, block.timestamp);

        totalStreamShares += weightedAmountOfSharesPerStream;
        lock.positionStreamShares += BoringMath.to128(weightedAmountOfSharesPerStream);

        uint256 streamsLength = streams.length;
        for (uint256 i; i < streamsLength; i++) {
            if (streams[i].status == StreamStatus.ACTIVE) {
                userAccount.rpsDuringLastClaimForLock[lockId][i] = streams[i].rps;
            }
        }
        emit Staked(account, amount, weightedAmountOfSharesPerStream, nVoteToken, lockId, lock.end);
    }

    function _unstake(uint256 amount, uint256 stakeValue, uint256 lockId, address account) internal {
        User storage userAccount = users[account];
        LockedBalance storage updateLock = locks[account][lockId - 1];
        totalAmountOfStakedToken -= stakeValue;
        totalStreamShares -= updateLock.positionStreamShares;

        updateLock.positionStreamShares = 0;
        updateLock.amountOfToken = 0;

        uint256 amountToRestake = stakeValue - amount;

        userAccount.pendings[MAIN_STREAM] += amount;
        userAccount.releaseTime[MAIN_STREAM] = block.timestamp + streams[MAIN_STREAM].tau;
        streamTotalUserPendings[MAIN_STREAM] += amount;
        ///@notice: Only update the lock if it has remaining stake
        if (amountToRestake > 0) {
            _restakeThePosition(amountToRestake, lockId, updateLock, userAccount);
            emit PartialUnstaked(account, amount, lockId);
        } else {
            _removeLockPosition(userAccount, account, lockId);
            emit Unstaked(account, amount, lockId);
        }
    }

    function _restakeThePosition(uint256 amountToRestake, uint256 lockId, LockedBalance storage updateLock, User storage userAccount) internal {
        totalAmountOfStakedToken += amountToRestake;
        updateLock.amountOfToken += BoringMath.to128(amountToRestake);
        ///@notice if you unstake, early or partial or complete,
        ///        the number of vote tokens for lock position is set to zero
        uint256 weightedAmountOfSharesPerStream = _weightedShares(amountToRestake, 0, block.timestamp);

        updateLock.positionStreamShares += BoringMath.to128(weightedAmountOfSharesPerStream);
        totalStreamShares += weightedAmountOfSharesPerStream;
        uint256 streamsLength = streams.length;
        for (uint256 i; i < streamsLength; i++) {
            // The new shares should not claim old rewards
            if (streams[i].status == StreamStatus.ACTIVE) {
                userAccount.rpsDuringLastClaimForLock[lockId][i] = streams[i].rps;
            }
        }
    }

    /**
     @dev Used to unlock a position early with penalty
     @dev This unlocks and unstakes the position completely and then applies penalty
     @notice The weighing function decreases based upon the remaining time left in the lock
     @notice The penalty is decreased from the pendings of Main stream
     @notice Early unlock completely unlocks your whole position and vote tokens
     @param lockId The lock id of lock position to early unlock
     @param account The account whose lock position is unlocked early
     */
    function _earlyUnlock(uint256 lockId, address account) internal {
        LockedBalance storage lock = locks[account][lockId - 1];
        uint256 lockEnd = lock.end;
        uint256 amount = lock.amountOfToken;
        _unlock(amount, amount, lockId, account);
        uint256 weighingCoef = _weightedPenalty(lockEnd, block.timestamp);
        uint256 penalty = (weighingCoef * amount) / 100000;
        User storage userAccount = users[account];
        userAccount.pendings[MAIN_STREAM] -= penalty;
        streamTotalUserPendings[MAIN_STREAM] -= penalty;
        totalPenaltyBalance += penalty;
    }

    function _removeLockPosition(User storage userAccount, address account, uint256 lockId) internal {
        uint256 streamsLength = streams.length;
        uint256 lastLockId = locks[account].length;
        if (lastLockId != lockId && lastLockId > 1) {
            LockedBalance storage lastIndexLockedBalance = locks[account][lastLockId - 1];
            locks[account][lockId - 1] = lastIndexLockedBalance;
            for (uint256 i; i < streamsLength; i++) {
                userAccount.rpsDuringLastClaimForLock[lockId][i] = userAccount.rpsDuringLastClaimForLock[lastLockId][i];
            }
        }
        for (uint256 i; i < streamsLength; i++) {
            delete userAccount.rpsDuringLastClaimForLock[lastLockId][i];
        }
        locks[account].pop();
    }

    function _withdraw(uint256 streamId) internal {
        User storage userAccount = users[msg.sender];
        uint256 pendingAmount = userAccount.pendings[streamId];
        userAccount.pendings[streamId] = 0;
        streamTotalUserPendings[streamId] -= pendingAmount;
        emit Released(streamId, msg.sender, pendingAmount);
        IVault(vault).payRewards(msg.sender, streams[streamId].rewardToken, pendingAmount);
    }

    function _withdrawPenalty(address accountTo) internal {
        uint256 pendingPenalty = totalPenaltyBalance;
        totalPenaltyBalance = 0;
        IVault(vault).payRewards(accountTo, mainToken, pendingPenalty);
    }

    function _weightedShares(uint256 amountOfTokenShares, uint256 nVoteToken, uint256 timestamp) internal view returns (uint256) {
        ///@notice Shares accomodate vote the amount of  tokenShares and vote Tokens to be released
        ///@notice This formula makes it so that both the time locked for Main token and the amount of token locked
        ///        is used to calculate rewards
        uint256 shares = amountOfTokenShares + (voteShareCoef * nVoteToken) / 1000;
        uint256 slopeStart = streams[MAIN_STREAM].schedule.time[0] + ONE_MONTH;
        uint256 slopeEnd = slopeStart + ONE_YEAR;
        if (timestamp <= slopeStart) return shares * weight.maxWeightShares;
        if (timestamp >= slopeEnd) return shares * weight.minWeightShares;
        return
            shares *
            weight.minWeightShares +
            (shares * (weight.maxWeightShares - weight.minWeightShares) * (slopeEnd - timestamp)) /
            (slopeEnd - slopeStart);
    }

    /**
     * @dev Calculates the penalty for early withdrawal
     * @notice The penalty decreases linearly over time
     * @notice The penalty depends upon the remaining time for opening of lock
     * @param lockEnd The timestamp when the lock will open
     * @param timestamp The current timestamp to calculate the remaining time
     */
    function _weightedPenalty(uint256 lockEnd, uint256 timestamp) internal view returns (uint256) {
        uint256 slopeStart = lockEnd;
        if (timestamp >= slopeStart) return 0;
        uint256 remainingTime = slopeStart - timestamp;
        //why weight multiplier: Because if a person remaining time is less than 12 hours, the calculation
        //would only give minWeightPenalty, because 2900 * 12hours/4days = 0
        return (weight.penaltyWeightMultiplier *
            weight.minWeightPenalty +
            (weight.penaltyWeightMultiplier * (weight.maxWeightPenalty - weight.minWeightPenalty) * remainingTime) /
            maxLockPeriod);
    }

    // solhint-disable code-complexity
    function _verifyStaking(
        address _mainToken,
        address _voteToken,
        address _treasury,
        Weight memory _weight,
        address _vault,
        uint256 _voteLockCoef
    ) internal pure {
        if (_mainToken == address(0x00)) {
            revert ZeroAddress();
        }
        if (_voteToken == address(0x00)) {
            revert ZeroAddress();
        }
        if (_vault == address(0x00)) {
            revert ZeroAddress();
        }
        if (_treasury == address(0x00)) {
            revert ZeroAddress();
        }
        if (_weight.maxWeightShares <= _weight.minWeightShares) {
            revert InvalidShareWeights();
        }
        if (_weight.maxWeightPenalty <= _weight.minWeightPenalty) {
            revert InvalidPenaltyWeights();
        }
        if (_weight.penaltyWeightMultiplier * _weight.maxWeightPenalty > 100000) {
            revert IncorrectWeight();
        }
        if (_voteLockCoef == 0) {
            revert ZeroCoefficient();
        }
    }
    // solhint-enable code-complexity
}
