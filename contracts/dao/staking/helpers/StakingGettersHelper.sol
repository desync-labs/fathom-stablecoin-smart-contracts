// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022
pragma solidity 0.8.17;

import "./IStakingHelper.sol";
import "./IStakingGetterHelper.sol";
import "../interfaces/IStakingGetter.sol";
import "../StakingStructs.sol";
import "../../../common/access/AccessControl.sol";

// solhint-disable not-rely-on-time
contract StakingGettersHelper is IStakingGetterHelper, AccessControl {
    address private stakingContract;

    error LockOpenedError();
    error LockIdOutOfIndexError();
    error LockIdCantBeZeroError();

    constructor(address _stakingContract, address admin) {
        stakingContract = _stakingContract;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function getLocksLength(address account) external view override returns (uint256) {
        LockedBalance[] memory locks = _getAllLocks(account);
        return locks.length;
    }

    function getWeight() external view override returns (Weight memory) {
        return _getWeight();
    }

    function getLock(address account, uint256 lockId) external view override returns (uint128, uint128, uint64, address, uint256) {
        LockedBalance memory lock = getLockInfo(account, lockId);
        return (lock.amountOfToken, lock.positionStreamShares, lock.end, lock.owner, lock.amountOfVoteToken);
    }

    function getUserTotalDeposit(address account) external view override returns (uint256) {
        LockedBalance[] memory locks = _getAllLocks(account);
        if (locks.length == 0) {
            return 0;
        }
        uint256 totalDeposit = 0;
        for (uint256 lockId = 1; lockId <= locks.length; lockId++) {
            totalDeposit += locks[lockId - 1].amountOfToken;
        }
        return totalDeposit;
    }

    function getStreamClaimableAmount(uint256 streamId, address account) external view override returns (uint256) {
        LockedBalance[] memory locks = _getAllLocks(account);
        if (locks.length == 0) {
            return 0;
        }
        uint256 totalRewards = 0;
        for (uint256 lockId = 1; lockId <= locks.length; lockId++) {
            totalRewards += IStakingHelper(stakingContract).getStreamClaimableAmountPerLock(streamId, account, lockId);
        }
        return totalRewards;
    }

    function getUserTotalVotes(address account) external view override returns (uint256) {
        LockedBalance[] memory locks = _getAllLocks(account);
        if (locks.length == 0) {
            return 0;
        }
        uint256 totalVotes = 0;
        for (uint256 lockId = 1; lockId <= locks.length; lockId++) {
            totalVotes += locks[lockId - 1].amountOfVoteToken;
        }
        return totalVotes;
    }

    function getFeesForEarlyUnlock(uint256 lockId, address account) external view override returns (uint256) {
        LockedBalance memory lock = getLockInfo(account, lockId);
        if (lock.end <= block.timestamp) {
            revert LockOpenedError();
        }

        uint256 amount = lock.amountOfToken;
        uint256 lockEnd = lock.end;
        uint256 weighingCoef = _weightedPenalty(lockEnd, block.timestamp);
        uint256 penalty = (weighingCoef * amount) / 100000;
        return penalty;
    }

    function getLockInfo(address account, uint256 lockId) public view override returns (LockedBalance memory) {
        LockedBalance[] memory locks = _getAllLocks(account);
        if (lockId > locks.length) {
            revert LockIdOutOfIndexError();
        }
        if (lockId == 0) {
            revert LockIdCantBeZeroError();
        }
        return locks[lockId - 1];
    }

    function _getAllLocks(address account) internal view returns (LockedBalance[] memory) {
        return IStakingHelper(stakingContract).getAllLocks(account);
    }

    function _weightedPenalty(uint256 lockEnd, uint256 timestamp) internal view returns (uint256) {
        Weight memory weight = _getWeight();
        uint256 maxLockPeriod = IStakingHelper(stakingContract).maxLockPeriod();
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

    function _getWeight() internal view returns (Weight memory) {
        return IStakingStorage(stakingContract).weight();
    }
}
