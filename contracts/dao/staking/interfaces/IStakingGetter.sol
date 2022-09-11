// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity ^0.8.13;

import "../StakingStructs.sol";

interface IStakingGetter {
    function getLatestRewardsPerShare(uint256 streamId) external view returns (uint256);

    function getLockInfo(address account, uint256 lockId) external view returns (LockedBalance memory);

    function getUsersPendingRewards(address account, uint256 streamId) external view returns (uint256);
    function getUserTotalDeposit(address account) external view returns (uint256);

    function getPending(uint256 streamId, address account) 
        external
        view
        returns (uint256);

    /// @param streamId the stream index
    function getStream(uint256 streamId)
        external
        view
        returns (
            address streamOwner,
            address rewardToken,
            uint256 rewardDepositAmount,
            uint256 rewardClaimedAmount,
            uint256 maxDepositAmount,
            uint256 rps,
            uint256 tau,
            StreamStatus status
        );
    
}
