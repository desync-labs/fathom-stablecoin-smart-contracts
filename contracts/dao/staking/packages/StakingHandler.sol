// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022
pragma solidity 0.8.17;

import "./StakingInternals.sol";
import "../StakingStorage.sol";
import "../interfaces/IStakingHandler.sol";
import "../vault/interfaces/IVault.sol";
import "../../../common/security/AdminPausable.sol";
import "../../../common/SafeERC20Staking.sol";

// solhint-disable not-rely-on-time
contract StakingHandlers is StakingStorage, IStakingHandler, StakingInternals, AdminPausable {
    using SafeERC20Staking for IERC20;
    bytes32 public constant STREAM_MANAGER_ROLE = keccak256("STREAM_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    error NotPaused();
    error VaultNotSupported(address _vault);
    error VaultNotMigrated(address _vault);
    error VaultMigrated(address _vault);
    error ZeroLockId();
    error MaxLockPeriodExceeded();
    error MaxLockIdExceeded(uint256 _lockId, address _account);
    error ZeroPenalty();
    error AlreadyInitialized();
    error StreamIdZero();
    error BadMaxLockPositions();
    error StreamNotWithdrawn();
    error NotProposed();
    error ProposalExpired();
    error NotOwner();
    error RewardsTooHigh();
    error RewardsTooLow();
    error LockNotClosed();
    error EarlyWithdrawalInfeasible();
    error LockAlreadyOpen();
    error UnsupportedToken();
    error BadStart();
    error NoActiveStream();
    error LockNotExpired();
    error NoPendings();
    error NotReleased();
    error StreamInactive();
    error MinLockPeriodNotMet();
    error MaxLockPositionsReached();
    error ZeroAmount();
    error NotLockOwner();
    error BadRewardsAmount();
    error NoLocks();

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev initialize the contract and deploys the first stream of rewards
     * @dev initializable only once due to stakingInitialised flag
     * @notice By calling this function, the deployer of this contract must
     * make sure that the Rewards amount was deposited to the treasury contract
     * before initializing of the default Stream
     * @param _vault The Vault address to store main token and rewards tokens
     * @param _mainToken token contract address
     * @param _weight Weighting coefficient for shares and penalties
     * @param _admin the owner and manager of the main token stream
     */
    function initializeStaking(
        address _admin,
        address _vault,
        address _treasury,
        address _mainToken,
        address _voteToken,
        Weight calldata _weight,
        VoteCoefficient calldata voteCoef,
        uint256 _maxLocks,
        address _rewardsContract,
        uint256 _minLockPeriod
    ) external override initializer {
        rewardsCalculator = _rewardsContract;
        _initializeStaking(_mainToken, _voteToken, _treasury, _weight, _vault, _maxLocks, voteCoef.voteShareCoef, voteCoef.voteLockCoef);
        if (!IVault(vault).isSupportedToken(_mainToken)) {
            revert UnsupportedToken();
        }
        pausableInit(1, _admin);
        _grantRole(STREAM_MANAGER_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _treasury);
        maxLockPeriod = ONE_YEAR;
        minLockPeriod = _minLockPeriod;
    }

    /**
     * @dev The function is callable only once, and it can be done only with admin,
     *       which at initial setup is Multisig
     */
    function initializeMainStream(
        address _owner,
        uint256[] calldata scheduleTimes,
        uint256[] calldata scheduleRewards,
        uint256 tau
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (mainStreamInitialized == true) {
            revert AlreadyInitialized();
        }
        IERC20(mainToken).safeTransferFrom(msg.sender, address(this), scheduleRewards[0]);
        _validateStreamParameters(
            _owner,
            mainToken,
            0,
            scheduleRewards[MAIN_STREAM],
            scheduleRewards[MAIN_STREAM],
            scheduleTimes,
            scheduleRewards,
            tau
        );
        uint256 streamId = 0;
        Schedule memory schedule = Schedule(scheduleTimes, scheduleRewards);
        streams.push(
            Stream({
                owner: _owner,
                manager: _owner,
                percentToTreasury: 0,
                rewardToken: mainToken,
                maxDepositAmount: 0,
                minDepositAmount: 0,
                rewardDepositAmount: scheduleRewards[0],
                rewardClaimedAmount: 0,
                schedule: schedule,
                status: StreamStatus.ACTIVE,
                tau: tau,
                rps: 0
            })
        );
        _adminPause(0);
        mainStreamInitialized = true;
        emit StreamProposed(streamId, _owner, mainToken, scheduleRewards[MAIN_STREAM]);
        emit StreamCreated(streamId, _owner, mainToken, tau);
        _transfer(scheduleRewards[0], mainToken);
    }

    /**
     * @dev An admin of the staking contract can allowlist (propose) a stream.
     * Allowlisting of the stream provides the option for the stream
     * owner (presumably the issuing party of a specific token) to
     * deposit some ERC-20 tokens on the staking contract and potentially
     * get in return some main tokens immediately. 
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
        uint256 percentToTreasury,
        uint256 maxDepositAmount,
        uint256 minDepositAmount,
        uint256[] calldata scheduleTimes,
        uint256[] calldata scheduleRewards,
        uint256 tau
    ) external override onlyRole(STREAM_MANAGER_ROLE) {
        _validateStreamParameters(
            streamOwner,
            rewardToken,
            percentToTreasury,
            maxDepositAmount,
            minDepositAmount,
            scheduleTimes,
            scheduleRewards,
            tau
        );
        if (!IVault(vault).isSupportedToken(rewardToken)) {
            revert UnsupportedToken();
        }
        Schedule memory schedule = Schedule(scheduleTimes, scheduleRewards);
        uint256 streamId = streams.length;
        streams.push(
            Stream({
                owner: streamOwner,
                manager: msg.sender,
                percentToTreasury: percentToTreasury,
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
     * @dev This function creates a stream and makes it live. Only the Stream Owner is able to call this function.
     *      Stream Owner is set while proposing a stream
     */
    function createStream(uint256 streamId, uint256 rewardTokenAmount) external override pausable(1) {
        Stream storage stream = streams[streamId];
        _verifyStream(stream);

        stream.status = StreamStatus.ACTIVE;

        if (rewardTokenAmount < REWARDS_TO_TREASURY_DENOMINATOR) {
            revert BadRewardsAmount();
        }
        uint256 rewardsTokenToTreasury = (stream.percentToTreasury * rewardTokenAmount) / REWARDS_TO_TREASURY_DENOMINATOR;

        stream.rewardDepositAmount = rewardTokenAmount - rewardsTokenToTreasury;

        if (stream.rewardDepositAmount < stream.maxDepositAmount) {
            _updateStreamsRewardsSchedules(streamId, stream.rewardDepositAmount);
        }

        if (stream.schedule.reward[0] != stream.rewardDepositAmount) {
            revert BadStart();
        }

        if (stream.rewardDepositAmount > stream.maxDepositAmount) {
            revert RewardsTooHigh();
        }
        if (stream.rewardDepositAmount < stream.minDepositAmount) {
            revert RewardsTooLow();
        }

        emit StreamCreated(streamId, stream.owner, stream.rewardToken, stream.tau);

        IERC20(stream.rewardToken).safeTransferFrom(msg.sender, address(this), rewardTokenAmount);
        if (rewardsTokenToTreasury > 0) {
            IERC20(stream.rewardToken).safeTransfer(treasury, rewardsTokenToTreasury);
        }
        _transfer(stream.rewardDepositAmount, stream.rewardToken);
    }

    /*
     * @dev Proposed stream can be cancelled by Stream Manager, which at the time of deployment is Multisig
     */
    function cancelStreamProposal(uint256 streamId) external override onlyRole(STREAM_MANAGER_ROLE) {
        Stream storage stream = streams[streamId];
        if (stream.status != StreamStatus.PROPOSED) {
            revert NotProposed();
        }
        stream.status = StreamStatus.INACTIVE;

        emit StreamProposalCancelled(streamId, stream.owner, stream.rewardToken);
    }

    /**
     * @dev A stream can be removed after all the rewards pending have been withdrawn.
     *      Stream can be removed by the Stream Manager which is Multisig at time of deployment.
     */
    function removeStream(uint256 streamId, address streamFundReceiver) external override onlyRole(STREAM_MANAGER_ROLE) {
        if (streamId == 0) {
            revert StreamIdZero();
        }
        if (streamTotalUserPendings[streamId] != 0) {
            revert StreamNotWithdrawn();
        }
        Stream storage stream = streams[streamId];
        if (stream.status != StreamStatus.ACTIVE) {
            revert NoActiveStream();
        }
        stream.status = StreamStatus.INACTIVE;
        uint256 releaseRewardAmount = stream.rewardDepositAmount - stream.rewardClaimedAmount;
        uint256 rewardTreasury = IERC20(stream.rewardToken).balanceOf(vault);

        IVault(vault).payRewards(
            streamFundReceiver,
            stream.rewardToken,
            releaseRewardAmount <= rewardTreasury ? releaseRewardAmount : rewardTreasury // should not happen
        );
        emit StreamRemoved(streamId, stream.owner, stream.rewardToken);
    }

    /**
     * @dev Admin can create a lock on behalf of a user without early withdrawal
     */
    function createFixedLocksOnBehalfOfUserByAdmin(CreateLockParams[] calldata lockPositions) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i; i < lockPositions.length; i++) {
            address account = lockPositions[i].account;
            if (account == address(0)) {
                revert ZeroAddress();
            }
            prohibitedEarlyWithdraw[account][locks[account].length + 1] = true;
            _createLock(lockPositions[i].amount, lockPositions[i].lockPeriod, account);
        }
    }

    function createLock(uint256 amount, uint256 lockPeriod) external override pausable(1) {
        _createLock(amount, lockPeriod, msg.sender);
    }

    function unlock(uint256 lockId) external override pausable(1) {
        _verifyUnlock(lockId);
        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        if (lock.end > block.timestamp) {
            revert LockNotClosed();
        }
        _updateStreamRPS();
        uint256 stakeValue = lock.amountOfToken;
        prohibitedEarlyWithdraw[msg.sender][lockId] = false;
        _unlock(stakeValue, stakeValue, lockId, msg.sender);
    }

    function unlockPartially(uint256 lockId, uint256 amount) external override pausable(1) {
        _verifyUnlock(lockId);
        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        if (lock.end > block.timestamp) {
            revert LockNotExpired();
        }
        _updateStreamRPS();
        uint256 stakeValue = lock.amountOfToken;
        prohibitedEarlyWithdraw[msg.sender][lockId] = false;
        _unlock(stakeValue, amount, lockId, msg.sender);
    }

    function earlyUnlock(uint256 lockId) external override pausable(1) {
        _verifyUnlock(lockId);
        if (prohibitedEarlyWithdraw[msg.sender][lockId]) {
            revert EarlyWithdrawalInfeasible();
        }
        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        if (lock.end <= block.timestamp) {
            revert LockAlreadyOpen();
        }
        _updateStreamRPS();
        _earlyUnlock(lockId, msg.sender);
    }

    function claimAllStreamRewardsForLock(uint256 lockId) external override pausable(1) {
        if (lockId > locks[msg.sender].length) {
            revert MaxLockIdExceeded(lockId, msg.sender);
        }
        if (lockId == 0) {
            revert ZeroLockId();
        }
        _updateStreamRPS();
        // Claim all streams while skipping inactive streams.
        _moveAllStreamRewardsToPending(msg.sender, lockId);
    }

    function claimAllLockRewardsForStream(uint256 streamId) external override pausable(1) {
        _updateStreamRPS();
        _moveAllLockPositionRewardsToPending(msg.sender, streamId);
    }

    function withdrawStream(uint256 streamId) external override pausable(1) {
        User storage userAccount = users[msg.sender];
        if (userAccount.pendings[streamId] == 0) {
            revert NoPendings();
        }

        if (block.timestamp <= userAccount.releaseTime[streamId]) {
            revert NotReleased();
        }

        if (streams[streamId].status != StreamStatus.ACTIVE) {
            revert StreamInactive();
        }
        _withdraw(streamId);
    }

    function withdrawAllStreams() external override pausable(1) {
        User storage userAccount = users[msg.sender];
        for (uint256 i; i < streams.length; i++) {
            if (userAccount.pendings[i] != 0 && block.timestamp > userAccount.releaseTime[i] && streams[i].status == StreamStatus.ACTIVE) {
                _withdraw(i);
            }
        }
    }

    /**
     * @dev In case of emergency, unlock your tokens and withdraw all your position
     * @notice This function neglects all the rewards
     * @notice This can be executed only if the contract is at paused state.
     * @notice This function can only be called if VaultContract is not compromised and vault is not at paused state.
     */
    function emergencyUnlockAndWithdraw() external override {
        if (paused == 0) {
            revert NotPaused();
        }
        if (IVault(vault).migrated()) {
            revert VaultMigrated(vault);
        }
        //unlock all locks
        uint256 numberOfLocks = locks[msg.sender].length;
        if (numberOfLocks == 0) {
            revert NoLocks();
        }
        for (uint256 lockId = numberOfLocks; lockId >= 1; lockId--) {
            uint256 stakeValue = locks[msg.sender][lockId - 1].amountOfToken;
            _unlock(stakeValue, stakeValue, lockId, msg.sender);
        }
        _withdraw(MAIN_STREAM);
    }

    /**
     * @dev Vault can be updated only if the contract is at paused state.
     *      Only Admin that is, Multisig at the time of deployment can update Vault
     */
    function updateVault(address _vault) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        // enforce pausing this contract before updating the address.
        // This mitigates the risk of future invalid reward claims
        if (paused == 0) {
            revert NotPaused();
        }
        if (_vault == address(0)) {
            revert ZeroAddress();
        }
        if (!IERC165Upgradeable(_vault).supportsInterface(type(IVault).interfaceId)) {
            revert VaultNotSupported(_vault);
        }
        if (!IVault(vault).migrated()) {
            revert VaultNotMigrated(vault);
        }
        vault = _vault;
    }

    /**
     * @dev Penalty accrued due to early unlocking can be withdrawn to some address, most likely the treasury.
     *      Address with TREASURY_ROLE can access this function, which is Multisig at time of deployment
     */
    function withdrawPenalty() external override pausable(1) onlyRole(TREASURY_ROLE) {
        if (totalPenaltyBalance == 0) {
            revert ZeroPenalty();
        }
        _withdrawPenalty(treasury);
    }

    /**
     * @dev This allows for setting up minimum locking period.
     *      Only admin which is Multisig at deployment can call this
     */
    function setMinimumLockPeriod(uint256 _minLockPeriod) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_minLockPeriod > maxLockPeriod) {
            revert MaxLockPeriodExceeded();
        }
        minLockPeriod = _minLockPeriod;
    }

    /**
     * @dev This allows for setting up maximum lock positions.
     *      Only admin which is Multisig at deployment can call this
     */
    function setMaxLockPositions(uint256 newMaxLockPositions) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMaxLockPositions < maxLockPositions) {
            revert BadMaxLockPositions();
        }
        maxLockPositions = newMaxLockPositions;
    }

    function setTreasuryAddress(address newTreasury) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) {
            revert ZeroAddress();
        }
        _revokeRole(TREASURY_ROLE, treasury);
        _grantRole(TREASURY_ROLE, newTreasury);
        treasury = newTreasury;
    }

    function _createLock(uint256 amount, uint256 lockPeriod, address account) internal {
        if (lockPeriod < minLockPeriod) {
            revert MinLockPeriodNotMet();
        }
        if (locks[account].length >= maxLockPositions) {
            revert MaxLockPositionsReached();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (lockPeriod > maxLockPeriod) {
            revert MaxLockPeriodExceeded();
        }
        IERC20(mainToken).safeTransferFrom(msg.sender, address(this), amount);
        _updateStreamRPS();
        _lock(account, amount, lockPeriod);
        _transfer(amount, mainToken);
    }

    function _transfer(uint256 _amount, address _token) internal {
        IERC20(_token).safeApprove(vault, 0);
        IERC20(_token).safeApprove(vault, _amount);
        IVault(vault).deposit(_token, _amount);
    }

    function _verifyStream(Stream memory stream) internal view {
        if (stream.status != StreamStatus.PROPOSED) {
            revert NotProposed();
        }
        if (stream.schedule.time[0] < block.timestamp) {
            revert ProposalExpired();
        }
        if (stream.owner != msg.sender) {
            revert NotOwner();
        }
    }

    function _verifyUnlock(uint256 lockId) internal view {
        if (lockId == 0) {
            revert ZeroLockId();
        }
        if (lockId > locks[msg.sender].length) {
            revert MaxLockIdExceeded(lockId, msg.sender);
        }
        LockedBalance storage lock = locks[msg.sender][lockId - 1];
        if (lock.owner != msg.sender) {
            revert NotLockOwner();
        }
        if (lock.amountOfToken == 0) {
            revert ZeroLocked(lockId);
        }
    }
}
