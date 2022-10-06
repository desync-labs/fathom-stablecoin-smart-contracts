// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;
import "../StakingStorage.sol";
import "../interfaces/IStakingHandler.sol";
import "./StakingInternals.sol";
import "../vault/interfaces/IVault.sol";
import "../utils/ReentrancyGuard.sol";
import "../utils/AdminPausable.sol";
import "../interfaces/IStakingSetter.sol";


// solhint-disable not-rely-on-time
contract StakingHandlers is StakingStorage, IStakingHandler, IStakingSetter, StakingInternals, ReentrancyGuard, 
                            AdminPausable {

    bytes32 public constant STREAM_MANAGER_ROLE =
        keccak256("STREAM_MANAGER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /**
    * @dev initialize the contract and deploys the first stream of rewards(MAINTkn)
    * @dev initializable only once due to stakingInitialised flag
    * @notice By calling this function, the deployer of this contract must
    * make sure that the MAINTkn Rewards amount was deposited to the treasury contract
    * before initializing of the default MAINTkn Stream
    * @param _vault The Vault address to store MAINTkn and rewards tokens
    * @param _mainTkn token contract address
    * @param _weight Weighting coefficient for shares and penalties
    * @param streamOwner the owner and manager of the MAINTkn stream
    * @param scheduleTimes init schedules times
    * @param scheduleRewards init schedule rewards
    * @param tau release time constant per stream
    * @param _voteShareCoef the weight of vote tokens during shares distribution.
             Should be passed in proportion of 1000. ie, if you want weight of 2, have to pass 2000
    * @param _voteLockWeight the weight that determines the amount of vote tokens to release
    */
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
    ) external override {
        require(!stakingInitialised, "Already intiailised");
        _validateStreamParameters(
            streamOwner,
            _mainTkn,
            scheduleRewards[0],
            scheduleRewards[0],
            scheduleTimes,
            scheduleRewards,
            tau
        );
        _initializeStaking(_mainTkn, _veMAINTkn, _weight, _vault, _voteShareCoef, _voteLockWeight, _maxLocks);
        require(IVault(vault).isSupportedToken(_mainTkn), "Unsupported token");
        pausableInit(0);
        _grantRole(STREAM_MANAGER_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        uint256 streamId = 0;
        Schedule memory schedule = Schedule(scheduleTimes, scheduleRewards);
        streams.push(
            Stream({
                owner: streamOwner,
                manager: streamOwner,
                rewardToken: mainTkn,
                maxDepositAmount: 0,
                minDepositAmount: 0,
                rewardDepositAmount: 0,
                rewardClaimedAmount: 0,
                schedule: schedule,
                status: StreamStatus.ACTIVE,
                tau: tau,
                rps: 0
            })
        );
        earlyWithdrawalFlag = true;
        stakingInitialised = true;
        emit StreamProposed(streamId, streamOwner, _mainTkn, scheduleRewards[0]);
        emit StreamCreated(streamId, streamOwner, _mainTkn, scheduleRewards[0]);
    }

    
    /**
     * @dev An admin of the staking contract can whitelist (propose) a stream.
     * Whitelisting of the stream provides the option for the stream
     * owner (presumably the issuing party of a specific token) to
     * deposit some ERC-20 tokens on the staking contract and potentially
     * get in return some MAINTkn tokens immediately. 
     * @notice Manager of Vault must call
     * @param streamOwner only this account will be able to launch a stream
     * @param rewardToken the address of the ERC-20 tokens to be deposited in the stream
     * @param maxDepositAmount The upper amount of the tokens that should be deposited by stream owner
     * @param scheduleTimes timestamp denoting the start of each scheduled interval.
                            Last element is the end of the stream.
     * @param scheduleRewards remaining rewards to be delivered at the beginning of each scheduled interval. 
                               Last element is always zero.
     * First value (in scheduleRewards) from array is supposed to be a total amount of rewards for stream.
     * @param tau the tau is (pending release period) for this stream (e.g one day)
    */
    function proposeStream(
        address streamOwner,
        address rewardToken,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] memory scheduleTimes,
        uint256[] memory scheduleRewards,
        uint256 tau
    ) external override onlyRole(STREAM_MANAGER_ROLE){
        _validateStreamParameters(
            streamOwner,
            rewardToken,
            maxDepositAmount,
            minDepositAmount,
            scheduleTimes,
            scheduleRewards,
            tau
        );
        // check mainTkn token address is supportedToken in the treasury
        require(IVault(vault).isSupportedToken(rewardToken), "Unsupport Token");
        Schedule memory schedule = Schedule(scheduleTimes, scheduleRewards);
        uint256 streamId = streams.length;
        streams.push(
            Stream({
                owner: streamOwner,
                manager: msg.sender,
                rewardToken: rewardToken,
                maxDepositAmount: maxDepositAmount,
                minDepositAmount: minDepositAmount,
                rewardDepositAmount: 0,
                rewardClaimedAmount: 0,
                schedule: schedule,
                status: StreamStatus.PROPOSED,
                tau: tau,
                rps: 0
            })
        );
        emit StreamProposed(streamId, streamOwner, rewardToken, maxDepositAmount);
    }

    /**
     * @dev create new stream (only stream owner)
     * stream owner must approve reward tokens to this contract.
     * @param streamId stream id
     */
    function createStream(uint256 streamId, uint256 rewardTokenAmount) external override pausable(1) {
        Stream storage stream = streams[streamId];
        require(stream.status == StreamStatus.PROPOSED, "Stream nt proposed");
        require(stream.schedule.time[0] >= block.timestamp, "Stream proposal expire");

        require(rewardTokenAmount <= stream.maxDepositAmount, "Rewards high");
        require(rewardTokenAmount >= stream.minDepositAmount, "Rewards low");

        stream.status = StreamStatus.ACTIVE;

        stream.rewardDepositAmount = rewardTokenAmount;
        if (rewardTokenAmount < stream.maxDepositAmount) {
            _updateStreamsRewardsSchedules(streamId, rewardTokenAmount);
        }
        require(stream.schedule.reward[0] == stream.rewardDepositAmount, "invalid start point");

        emit StreamCreated(streamId, stream.owner, stream.rewardToken, rewardTokenAmount);

        IERC20(stream.rewardToken).transferFrom(msg.sender, address(vault), rewardTokenAmount);
    }

    //STREAM_MANAGER_ROLE
    function cancelStreamProposal(uint256 streamId) external override onlyRole(STREAM_MANAGER_ROLE){
        Stream storage stream = streams[streamId];
        require(stream.status == StreamStatus.PROPOSED, "stream nt proposed");
        // cancel pa proposal
        stream.status = StreamStatus.INACTIVE;

        emit StreamProposalCancelled(streamId, stream.owner, stream.rewardToken);
    }

    // STREAM_MANAGER_ROLE
    /// @dev removes a stream (only default admin role)
    /// @param streamId stream index
    function removeStream(uint256 streamId, address streamFundReceiver) external override onlyRole(STREAM_MANAGER_ROLE){
        require(streamId != 0, "Stream 0");
        Stream storage stream = streams[streamId];
        require(stream.status == StreamStatus.ACTIVE, "No Stream");
        stream.status = StreamStatus.INACTIVE;
        uint256 releaseRewardAmount = stream.rewardDepositAmount - stream.rewardClaimedAmount;
        uint256 rewardTreasury = _getVaultBalance(stream.rewardToken);

        IVault(vault).payRewards(
            streamFundReceiver,
            stream.rewardToken,
            releaseRewardAmount <= rewardTreasury ? releaseRewardAmount : rewardTreasury // should not happen
        );

        emit StreamRemoved(streamId, stream.owner, stream.rewardToken);
    }

    /**
     * @dev Creates a new lock position with lock period of unlock time
     * @param amount the amount for a lock position
     * @param unlockTime the locking period
     */
    function createLock(uint256 amount, uint256 unlockTime) external override nonReentrant pausable(1) {
        require(locks[msg.sender].length <= maxLockPositions, "max locks");
        require(amount > 0, "amount 0");
        require(unlockTime > block.timestamp, "bad lock time");
        require(unlockTime <= block.timestamp + MAX_LOCK, "max 1 year");

        _before();
        LockedBalance memory _newLock = LockedBalance({
            amountOfMAINTkn: 0,
            amountOfveMAINTkn: 0,
            mainTknShares: 0,
            positionStreamShares: 0,
            end: BoringMath.to64(unlockTime),
            owner: msg.sender
        });
        _lock(msg.sender, _newLock, amount);
        IERC20(mainTkn).transferFrom(msg.sender, address(vault), amount);
    }

    /**
     * @dev This function unlocks the whole position of the lock id.
     * @notice stakeValue is calcuated to balance the shares calculation
     * @param lockId The lockId to unlock completely
     */
    function unlock(uint256 lockId) external override nonReentrant pausable(1) {
        require(lockId != 0, "lockId 0");
        require(lockId <= locks[msg.sender].length, "invalid lockid");

        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        require(lock.amountOfMAINTkn > 0, "no lock amount");
        require(lock.end <= block.timestamp, "lock not open");
        require(lock.owner == msg.sender, "bad owner");

        _before();
        //_moveAllRewardsToPending(msg.sender, lockId);
        uint256 stakeValue = (totalAmountOfStakedMAINTkn * lock.mainTknShares) / totalMAINTknShares;

        _unlock(lockId, stakeValue, stakeValue, lock, msg.sender);
    }

    /**
     * @dev This funciton allows for earlier withdrawal but with penalty
     * @param lockId The lock id to unlock early
     */
    function earlyUnlock(uint256 lockId) external override nonReentrant pausable(1) {
        require(earlyWithdrawalFlag == true, "no early withdraw");
        require(lockId != 0, "lockId 0");
        require(lockId <= locks[msg.sender].length, "invalid lockid");
        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        require(lock.amountOfMAINTkn > 0, "no lock amount");
        require(lock.end > block.timestamp, "lock opened");
        require(lock.owner == msg.sender, "bad owner");
        _before();
        //_moveAllRewardsToPending(msg.sender, lockId);
        uint256 stakeValue = (totalAmountOfStakedMAINTkn * lock.mainTknShares) / totalMAINTknShares;
        _earlyUnlock(lockId, stakeValue, stakeValue, lock, msg.sender);
    }

    /**
     * @dev This function claims rewards of a stream for a lock position and adds to pending of user.
     * @param streamId The id of the stream to claim rewards from
     * @param lockId The position of lock to claim rewards
     */
    function claimRewards(uint256 streamId, uint256 lockId) external override pausable(1) {
        require(lockId <= locks[msg.sender].length, "invalid lockid");
        _before();
        _moveRewardsToPending(msg.sender, streamId, lockId);
    }

    /**
     * @dev This function claims all the rewards for lock position and adds to pending of user.
     * @param lockId The position of lock to claim rewards
     */
    function claimAllRewards(uint256 lockId) external override pausable(1) {
        require(lockId <= locks[msg.sender].length, "invalid lockid");
        _before();
        // Claim all streams while skipping inactive streams.
        _moveAllRewardsToPending(msg.sender, lockId);
    }

    /**
     * @dev moves a set of stream Id rewards to pending of a locked position.
     * Allows user to select stream ids to claim from UI.
     * @param streamIds stream indexes
     * @param lockId The position of lock to claim rewards
     */
    function batchClaimRewards(uint256[] calldata streamIds, uint256 lockId) external override pausable(1) {
        require(lockId <= locks[msg.sender].length, "invalid lockid");
        _before();
        _batchMoveRewardsToPending(msg.sender, streamIds, lockId);
    }

    /**
     * @dev withdraw amount in the pending pool. User should wait for
     * pending time (tau constant) in order to be able to withdraw.
     * @param streamId stream index
     */
    function withdraw(uint256 streamId) external override pausable(1) {
        require(block.timestamp > users[msg.sender].releaseTime[streamId], "not released yet");
        _withdraw(streamId);
    }

    /**
     * @dev withdraw all claimed balances which have passed pending periode.
     * This function will reach gas limit with too many streams,
     * so the frontend will allow individual stream withdrawals and disable withdrawAll.
     */
    function withdrawAll() external override pausable(1) {
        User storage userAccount = users[msg.sender];
        uint256 streamsLength = streams.length;
        for (uint256 i = 0; i < streamsLength; i++) {
            if (userAccount.pendings[i] != 0 && block.timestamp > userAccount.releaseTime[i]) {
                _withdraw(i);
            }
        }
    }

    function withdrawPenalty(address penaltyReceiver) external override pausable(1) onlyRole(GOVERNANCE_ROLE){
        require(totalPenaltyBalance > 0, "no penalty");
        _withdrawPenalty(penaltyReceiver);
    }

    function setGovernanceContract(
        address _govnContract
    ) external override onlyRole(GOVERNANCE_ROLE){
        _grantRole(GOVERNANCE_ROLE, _govnContract);
        govnContract = _govnContract;
    }

    function setMaxLockPositions(
        uint8 _maxLockPositions
    ) external override {
        uint256 oldMaxLockPositions = maxLockPositions;
        maxLockPositions = _maxLockPositions;
        emit MaxLockPositionsSet(oldMaxLockPositions, _maxLockPositions);
    }

    function setEarlyWithdrawalFlag(
        bool _flag
    ) external override onlyRole(GOVERNANCE_ROLE){
        bool oldFlag = earlyWithdrawalFlag;
        earlyWithdrawalFlag = _flag;
        emit EarlyWithdrawalFlagSet(oldFlag, _flag);
    }

    function setTreasuryAddress(
        address _treasury 
    ) external override onlyRole(GOVERNANCE_ROLE){
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryAddressSet(oldTreasury, treasury);
    }
}
