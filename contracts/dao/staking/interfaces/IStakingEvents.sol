// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;
import "./IStakingSetterEvents.sol";

interface IStakingEvents is IStakingSetterEvents {
    event Staked(address account, uint256 indexed streamShares, uint256 indexed nVEMainTkn, uint256 indexed lockId);

    event StreamProposed(
        uint256 indexed streamId,
        address indexed streamOwner,
        address indexed rewardToken,
        uint256 maxDepositAmount
    );

    event StreamOwnerRewardReleased(
        uint256 indexed streamId,
        address indexed streamOwner,
        uint256 mainTknStreamOwnerReward
    );

    event Released(uint256 indexed streamId, address indexed user, uint256 pendingAmount);

    event StreamProposalCancelled(uint256 indexed streamId, address indexed owner, address indexed token);

    event StreamCreated(uint256 indexed streamId, address indexed owner, address indexed token, uint256 tokenAmount);

    event StreamRemoved(uint256 indexed streamId, address indexed owner, address indexed token);

    event Unstaked(address indexed account, uint256 indexed amount, uint256 indexed lockId);

    event Pending(uint256 indexed streamId, address indexed account, uint256 indexed pendings);
}
