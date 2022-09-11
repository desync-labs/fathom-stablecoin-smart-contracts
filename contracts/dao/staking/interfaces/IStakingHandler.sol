// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity ^0.8.13;

import "../StakingStructs.sol";
import "./IStakingGetter.sol";

interface IStakingHandler {
    function proposeStream(
        address streamOwner,
        address rewardToken,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] memory scheduleTimes,
        uint256[] memory scheduleRewards,
        uint256 tau
    ) external; // only STREAM_MANAGER_ROLE

    function initializeStaking(
        address _vault,
        address _mainTkn,
        address _veMAINTkn,
        Weight memory _weight,
        address streamOwner,
        uint256[] memory scheduleTimes,
        uint256[] memory scheduleRewards,
        uint256 tau,
        uint256 _voteShareCoef,
        uint256 _voteLockWeight,
        uint256 _maxLocks
    ) external;

    function removeStream(uint256 streamId, address streamFundReceiver) external;

    /// @notice Create a new lock.
    /// @dev This will crate a new lock and deposit MAINTkn to MAINTknStaking
    /// calls releaseGovernanceToken(uint256 amount, uint256 _unlockTime)
    function createLock(uint256 amount, uint256 unlockTime) external;

    // function stake(uint256 amount, address account) external;
    function createStream(uint256 streamId, uint256 rewardTokenAmount) external;

    // function stakeOnLockPosition(uint256 amount, uint256 lockId) external;
    //function unstakeLockedPosition(uint256 lockId, uint256 amount) external;

    function unlock(uint256 lockId) external;

    function cancelStreamProposal(uint256 streamId) external;

    function earlyUnlock(uint256 lockId) external;

    function claimRewards(uint256 streamId, uint256 lockId) external;

    function claimAllRewards(uint256 lockId) external;

    function batchClaimRewards(uint256[] calldata streamIds, uint256 lockId) external;

    function withdraw(uint256 streamId) external;

    function withdrawAll() external;

    function withdrawPenalty(address penaltyReceiver) external;
}
