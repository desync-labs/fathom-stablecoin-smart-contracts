// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;

enum StreamStatus {
    INACTIVE,
    PROPOSED,
    ACTIVE
}

struct Schedule {
    uint256[] time;
    uint256[] reward;
}

struct User {

    uint128 veMAINTknBalance;
    uint128 veMAINTknReleased;
    mapping(uint256 => uint256) pendings; // The amount of tokens pending release for user per stream
    mapping(uint256 => uint256) releaseTime; // The release moment per stream
    mapping(uint256 => mapping(uint256 => uint256)) rpsDuringLastClaimForLock;
}

struct Weight {
    uint32 maxWeightShares;
    uint32 minWeightShares;
    uint32 maxWeightPenalty;
    uint32 minWeightPenalty;
    uint32 penaltyWeightMultiplier;
}

struct LockedBalance {
    uint128 amountOfMAINTkn;
    uint128 amountOfveMAINTkn;
    uint128 mainTknShares;
    uint128 positionStreamShares;
    uint64 end;
    address owner;
}
struct Stream {
    address owner; // stream owned by the ERC-20 reward token owner
    address manager; // stream manager handled by MAINTkn stream manager role
    address rewardToken;
    uint256 rewardDepositAmount;
    uint256 rewardClaimedAmount;
    uint256 maxDepositAmount;
    uint256 minDepositAmount;
    uint256 tau; // pending time prior reward release
    uint256 rps; // Reward per share for a stream j>0
    Schedule schedule;
    StreamStatus status;
}
