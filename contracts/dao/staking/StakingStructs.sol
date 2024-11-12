// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

enum StreamStatus {
    INACTIVE,
    PROPOSED,
    ACTIVE
}

//time: timestamp denoting the start of each scheduled interval.
//Last element is the end of the stream.
//reward: remaining rewards to be delivered at the beginning of each scheduled interval.
//Last element is always zero.
struct Schedule {
    uint256[] time;
    uint256[] reward;
}

struct User {
    uint256 voteTokenBalance;
    //streamId => pendings
    mapping(uint256 => uint256) pendings; // The amount of tokens pending release for user per stream
    //streamId => releaseTime
    mapping(uint256 => uint256) releaseTime; // The release moment per stream
    //streamId => lockId => rewardsPerShare
    mapping(uint256 => mapping(uint256 => uint256)) rpsDuringLastClaimForLock;
}

struct Weight {
    uint32 maxWeightShares; // used for decreasing weighing function. It represents max ratio of amount
    uint32 minWeightShares; // used for decreasing weighing function. It represents min ratio of amount
    //eg: maxWeightShares = 1024 minWeightShares = 256 . So weighing function would decrease as:
    //1024 / 1024 (100 %) to (1024 - 256 / 1024)(25 %) depending upon time of stake.
    uint32 maxWeightPenalty; // used for penalty. It represents max ratio of penalty
    uint32 minWeightPenalty; // used for penalty. It represents min ratio of penalty
    uint32 penaltyWeightMultiplier;
}

struct VoteCoefficient {
    uint32 voteShareCoef;
    uint32 voteLockCoef;
}

struct LockedBalance {
    uint128 amountOfToken;
    uint128 positionStreamShares;
    uint64 end;
    address owner;
    uint256 amountOfVoteToken;
}
struct Stream {
    address owner; // stream owned by the ERC-20 reward token owner
    address manager; // stream manager handled by Main stream manager role
    uint256 percentToTreasury;
    address rewardToken;
    StreamStatus status;
    uint256 rewardDepositAmount; // the reward amount that has been deposited by third party
    uint256 rewardClaimedAmount; /// how much rewards have been claimed by stakers
    uint256 maxDepositAmount; // maximum amount of deposit
    uint256 minDepositAmount; // minimum amount of deposit
    uint256 tau; // pending time prior reward release
    uint256 rps; // Reward per share for a stream j>0
    Schedule schedule;
}

struct CreateLockParams {
    uint256 amount;
    uint256 lockPeriod;
    address account;
}
