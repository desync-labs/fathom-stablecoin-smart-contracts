// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IStakingEvents {
    event Staked(address indexed account, uint256 amount, uint256 streamShares, uint256 nVoteToken, uint256 indexed lockId, uint256 end);
    event StreamProposed(uint256 indexed streamId, address indexed streamOwner, address indexed rewardToken, uint256 maxDepositAmount);
    event Released(uint256 indexed streamId, address indexed user, uint256 pendingAmount);
    event StreamProposalCancelled(uint256 indexed streamId, address indexed owner, address indexed token);
    event StreamCreated(uint256 indexed streamId, address indexed owner, address indexed token, uint256 tau);
    event StreamRemoved(uint256 indexed streamId, address indexed owner, address indexed token);
    event Unstaked(address indexed account, uint256 amount, uint256 indexed lockId);
    event PartialUnstaked(address indexed account, uint256 amount, uint256 indexed lockId);
    event Pending(uint256 indexed streamId, address indexed account, uint256 pendings);
}
