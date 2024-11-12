// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./interfaces/IStakingStorage.sol";

contract StakingStorage {
    uint256 internal constant MAIN_STREAM = 0;
    //Set according to Tokenomics: Max Supply: 1e9 * 1e18, weight = 1e3, tolerance for changes = 6, so 1e36
    uint256 internal constant RPS_MULTIPLIER = 1e36;
    uint128 internal constant POINT_MULTIPLIER = 1e18;
    uint32 internal constant ONE_MONTH = 2629746;
    uint32 internal constant ONE_YEAR = 31536000;
    uint32 internal constant ONE_DAY = 86400;
    uint32 internal constant REWARDS_TO_TREASURY_DENOMINATOR = 10000;

    uint256 public maxLockPeriod;
    uint256 public minLockPeriod;
    uint256 public maxLockPositions;
    mapping(address => mapping(uint256 => bool)) internal prohibitedEarlyWithdraw;
    uint256 internal touchedAt;

    uint256 public totalAmountOfStakedToken;
    uint256 public totalStreamShares;
    uint256 public totalAmountOfVoteToken;

    uint256 public totalPenaltyBalance;
    /// _voteShareCoef the weight of vote tokens during shares distribution.
    /// Should be passed in proportion of 1000. ie, if you want weight of 2, have to pass 2000
    uint256 internal voteShareCoef;
    ///_voteLockWeight the weight that determines the amount of vote tokens to release
    uint256 internal voteLockCoef;

    address public mainToken;
    address public voteToken;
    address public vault;
    address public rewardsCalculator;
    address public treasury;
    bool internal mainStreamInitialized;

    ///Weighting coefficient for shares and penalties
    Weight public weight;

    mapping(address => User) public users;

    Stream[] internal streams;
    ///Mapping (user => LockedBalance) to keep locking information for each user
    mapping(address => LockedBalance[]) internal locks;
    mapping(uint256 => uint256) public streamTotalUserPendings;
}
