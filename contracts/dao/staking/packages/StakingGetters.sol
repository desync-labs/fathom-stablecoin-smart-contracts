// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;
import "../StakingStorage.sol";
import "../interfaces/IStakingGetter.sol";
import "./StakingInternals.sol";

contract StakingInitPackageGetter is StakingStorage, IStakingGetter, StakingInternals {
    function getLatestRewardsPerShare(uint256 streamId) external view override returns (uint256) {
        return _getLatestRewardsPerShare(streamId);
    }

    function getLockInfo(address account, uint256 lockId) external view override returns (LockedBalance memory) {
        require(lockId <= locks[account].length, "getLockInfo: LockId out of index");
        return locks[account][lockId - 1];
    }

    function getUsersPendingRewards(address account, uint256 streamId) external view override returns (uint256) {
        return users[account].pendings[streamId];
    }

    /// @dev gets the total user deposit
    /// @param account the user address
    /// @return user total deposit in (Main Token)
    function getUserTotalDeposit(address account)
        external
        view
        override
        returns (uint256)
    {
        uint totalDeposit = 0;
        for(uint i = 0;i<locks[account].length;i++){
            totalDeposit += locks[account][i].amountOfMAINTkn;
        }
        return totalDeposit;
    }


    /// @dev gets the user's stream pending reward
    /// @param streamId stream index
    /// @param account user account
    /// @return user.pendings[streamId]
    function getPending(uint256 streamId, address account) 
        external
        view
        override
        returns (uint256)
    {
        return users[account].pendings[streamId];
    } 


    /// @dev get the stream data
    /// @notice this function doesn't return the stream
    /// schedule due to some stake slots limitations. To
    /// get the stream schedule, refer to getStreamSchedule
    /// @param streamId the stream index
    function getStream(uint256 streamId)
        external
        view
        override
        returns (
            address streamOwner,
            address rewardToken,
            uint256 rewardDepositAmount,
            uint256 rewardClaimedAmount,
            uint256 maxDepositAmount,
            uint256 rps,
            uint256 tau,
            StreamStatus status
        )
    {
        Stream storage stream = streams[streamId];
        return (
            stream.owner,
            stream.rewardToken,
            stream.rewardDepositAmount,
            stream.rewardClaimedAmount,
            stream.maxDepositAmount,
            stream.rps,
            stream.tau,
            stream.status
        );
    }

}
