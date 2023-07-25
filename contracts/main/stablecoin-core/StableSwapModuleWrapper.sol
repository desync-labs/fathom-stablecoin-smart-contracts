// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IToken.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IStablecoin.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStableSwapModule.sol";
import "../utils/SafeToken.sol";
import "../interfaces/IStableSwapModuleWrapper.sol";
import "../interfaces/IStableSwapRetriever.sol";

contract StableSwapModuleWrapper is PausableUpgradeable, ReentrancyGuardUpgradeable, IStableSwapModuleWrapper{
    using SafeToken for address;
    uint256 internal constant WAD = 10 ** 18;

    IBookKeeper public bookKeeper;

    address public stablecoin;
    address public token;
    address public stableSwapModule;
    bool public isDecentralizedState;
    uint256 public totalValueDeposited;

    mapping(address => uint256) public depositTracker;
    mapping(address => bool) public usersWhitelist;

    //storage variables after upgrade - 1
    mapping(address => uint256) public checkpointFXDFee;
    mapping(address => uint256) public checkpointTokenFee;

    mapping(address => uint256) public claimedFXDFeeRewards;
    mapping(address => uint256) public claimedTokenFeeRewards;
    
    event LogDepositTokens(address indexed _depositor, uint256 _amount);
    event LogWithdrawTokens(address indexed _depositor, uint256 _amount);
    event LogAddToWhitelist(address indexed user);
    event LogRemoveFromWhitelist(address indexed user);
    event LogStableSwapWrapperPauseState(bool _pauseState);
    event LogUpdateIsDecentralizedState(bool _isDecentralizedState);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyWhitelistedIfNotDecentralized() {
        if (!isDecentralizedState) {
            require(usersWhitelist[msg.sender], "user-not-whitelisted");
        }
        _;
    }

    function initialize(address _bookKeeper, address _stableswapModule) external initializer {
        require(AddressUpgradeable.isContract(_stableswapModule), "stableswapModule-not-contract");
        require(AddressUpgradeable.isContract(_bookKeeper), "bookkeeper-not-contract");

        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        bookKeeper = IBookKeeper(_bookKeeper);
        stableSwapModule = _stableswapModule;
        stablecoin = IStableSwapModule(_stableswapModule).stablecoin();
        token = IStableSwapModule(_stableswapModule).token();
    }

    function addToWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = true;
        emit LogAddToWhitelist(_user);
    }

    function removeFromWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = false;
        emit LogRemoveFromWhitelist(_user);
    }

    function setIsDecentralizedState(bool _isDecentralizedState) external onlyOwner {
        isDecentralizedState = _isDecentralizedState;
        emit LogUpdateIsDecentralizedState(isDecentralizedState);
    }

    /**
     * @dev _amount arg should be in 18 decimals
     * @dev when you deposit tokens, you are depositing _amount of Stablecoin and Token each. So, the total deposit is twice the _amount   
     * @notice claimFeesRewards is before deposit tracker is updated because we need to claim for all the liquidity available currently
     */
    function depositTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized {
        require(_amount != 0, "wrapper-depositTokens/amount-zero");
        uint256 _amountScaled = _convertDecimals(_amount, 18, IToken(token).decimals());
        require(IToken(token).balanceOf(msg.sender) >= _amountScaled, "depositTokens/token-not-enough");
        require(IToken(stablecoin).balanceOf(msg.sender) >= _amount, "depositTokens/FXD-not-enough");
        
        _claimFeesRewards();
        
        _transferToTheContract(stablecoin, _amount);
        _transferToTheContract(token, _amountScaled);

        depositTracker[msg.sender] += 2 * _amount;
        totalValueDeposited += 2 * _amount;

        _depositToStableSwap(stablecoin, _amount);
        _depositToStableSwap(token, _amountScaled);

        emit LogDepositTokens(msg.sender, _amount);
    }

    /**
     * @dev _amount arg should be in 18 decimals
     * @dev when you withdraw tokens, you are withdrawing _amount of total tokens , ie half of stablecoin and half of token
     * @dev please consider that the withdraw of each token is not exactly half but depends upon ratio of tokens in the stableswap
     * @notice claimFeesRewards is before deposit tracker is updated because we need to claim for all the liquidity available currently
     */
    function withdrawTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized {
        require(_amount != 0, "withdrawTokens/amount-zero");
        require(depositTracker[msg.sender] >= _amount, "withdrawTokens/amount-exceeds-users-deposit");
        require(totalValueDeposited >= _amount , "withdrawTokens/amount-exceeds-total-deposit");
        
        _claimFeesRewards();
        _withdrawClaimedFees();

        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);

        require(
            stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals >= _amount,
            "withdrawTokens/amount-exceed-total-balance-in-stableswap"
        );

        uint256 stablecoinAmountToWithdraw = (_amount * WAD * stablecoinBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        uint256 tokenAmountToWithdraw = (_amount * WAD * tokenBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        require(stablecoinAmountToWithdraw + tokenAmountToWithdraw <= _amount, "withdrawTokens/total-amount-from-stableswap-exceeds-amount");
        uint256 tokenAmountToWithdrawScaled = _convertDecimals(tokenAmountToWithdraw, 18, IToken(token).decimals());

        _withdrawFromStableSwap(stablecoin, stablecoinAmountToWithdraw);
        _withdrawFromStableSwap(token, tokenAmountToWithdrawScaled);

        depositTracker[msg.sender] -= _amount;
        totalValueDeposited -= _amount;

        _transferToUser(stablecoin, stablecoinAmountToWithdraw);
        _transferToUser(token, tokenAmountToWithdrawScaled);

        emit LogWithdrawTokens(msg.sender, _amount);
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external onlyOwnerOrGov {
        _pause();
        emit LogStableSwapWrapperPauseState(true);
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external onlyOwnerOrGov {
        _unpause();
        emit LogStableSwapWrapperPauseState(false);
    }


    function claimFeesRewards() external override whenNotPaused {
        _claimFeesRewards();
    }

    
    function withdrawClaimedFees() external override nonReentrant whenNotPaused {
        require(claimedFXDFeeRewards[msg.sender] != 0 || claimedTokenFeeRewards[msg.sender] != 0, "withdrawClaimedFees/no-claimed-fees");
        _withdrawClaimedFees();
    }

    /**
     * @dev emergencyWithdraw, allowed when SSM and Wrapper is paused
     * @notice the function is used in emergency scenario, where the LPs will get back all of their shares of tokens in the stableswap
     */
    function emergencyWithdraw() external override nonReentrant whenPaused {
        require(IStableSwapRetriever(stableSwapModule).paused(),"emergencyWithdraw/SSM-not-paused");
        require(depositTracker[msg.sender] != 0, "emergencyWithdraw/amount-zero");
        (uint256 stablecoinAmountToWithdraw, uint256 tokenAmountToWithdraw) = this.getActualLiquidityAvailablePerUser(msg.sender);
        
        depositTracker[msg.sender] = 0;

        if(totalValueDeposited > stablecoinAmountToWithdraw + tokenAmountToWithdraw) {
            totalValueDeposited -= (stablecoinAmountToWithdraw + tokenAmountToWithdraw);
        } else {
            totalValueDeposited = 0;
        }
        
        checkpointFXDFee[msg.sender] = 0;
        checkpointTokenFee[msg.sender] = 0;
        
        claimedFXDFeeRewards[msg.sender] = 0;
        claimedTokenFeeRewards[msg.sender] = 0;
        
        _withdrawFromStableSwap(stablecoin, stablecoinAmountToWithdraw);
        uint256 tokenAmountToWithdrawScaled = _convertDecimals(tokenAmountToWithdraw, 18, IToken(token).decimals());
        _withdrawFromStableSwap(token, tokenAmountToWithdrawScaled);
    }

    function getAmounts(uint256 _amount) external override view returns(uint256, uint256) {
        require(_amount != 0, "getAmounts/amount-zero");
        require(depositTracker[msg.sender] >= _amount, "getAmounts/amount-exceeds-users-deposit");
        require(totalValueDeposited >= _amount, "getAmounts/amount-exceeds-total-deposit");

        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);

        uint256 stablecoinAmountToWithdraw = (_amount * WAD * stablecoinBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        uint256 tokenAmountToWithdraw = (_amount * WAD * tokenBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        return (stablecoinAmountToWithdraw, tokenAmountToWithdraw);
    }

    function getActualLiquidityAvailablePerUser(address account) external view override returns (uint256, uint256) {
        uint256 _amount = depositTracker[account];
        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);

        uint256 stablecoinAmountToWithdraw = (_amount * WAD * stablecoinBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        uint256 tokenAmountToWithdraw = (_amount * WAD * tokenBalanceStableSwap18Decimals) /
            (stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) /
            WAD;

        return (stablecoinAmountToWithdraw, tokenAmountToWithdraw);
    }

    function getClaimableFeesPerUser(address account) external view override returns (uint256, uint256) {
        uint256 totalStablecoinLiquidity = _totalStablecoinBalanceStableswap();
        uint256 totalTokenLiquidity = _totalTokenBalanceStableswap();
        
        uint256 stablecoinProviderLiquidity = depositTracker[account] * WAD / (2 * WAD);
        uint256 tokenProviderLiquidity = _convertDecimals(depositTracker[account] * WAD / (2 * WAD), 18, IToken(token).decimals());
        
        uint256 unclaimedStablecoinFees = _totalFXDFeeBalance() - checkpointFXDFee[account];
        uint256 unclaimedTokenFees = _totalTokenFeeBalance() - checkpointTokenFee[account];
        
        uint256 newFeeRewardsForStablecoin;
        uint256 newFeesRewardsForToken;

        if(totalStablecoinLiquidity > 0){
            newFeeRewardsForStablecoin = (unclaimedStablecoinFees * stablecoinProviderLiquidity * WAD) / totalStablecoinLiquidity / WAD;
        }

        if(totalTokenLiquidity > 0){
            newFeesRewardsForToken = (unclaimedTokenFees * tokenProviderLiquidity * WAD) / totalTokenLiquidity / WAD;
        }

        return (newFeeRewardsForStablecoin, newFeesRewardsForToken);
    }
    


    function _claimFeesRewards() internal {
        uint256 totalStablecoinLiquidity = _totalStablecoinBalanceStableswap();
        uint256 totalTokenLiquidity = _totalTokenBalanceStableswap();
        
        uint256 stablecoinProviderLiquidity = depositTracker[msg.sender] * WAD / (2 * WAD);
        uint256 tokenProviderLiquidity = _convertDecimals(depositTracker[msg.sender] * WAD / (2 * WAD), 18, IToken(token).decimals());
        
        uint256 unclaimedStablecoinFees = _totalFXDFeeBalance() - checkpointFXDFee[msg.sender];
        uint256 unclaimedTokenFees = _totalTokenFeeBalance() - checkpointTokenFee[msg.sender];
        
        uint256 newFeeRewardsForStablecoin;
        uint256 newFeesRewardsForToken;

        if(totalStablecoinLiquidity > 0){
            newFeeRewardsForStablecoin = (unclaimedStablecoinFees * stablecoinProviderLiquidity * WAD) / totalStablecoinLiquidity / WAD;
        }
        if(totalTokenLiquidity > 0){
            newFeesRewardsForToken = (unclaimedTokenFees * tokenProviderLiquidity * WAD) / totalTokenLiquidity / WAD;
        }

        claimedFXDFeeRewards[msg.sender] += newFeeRewardsForStablecoin;
        claimedTokenFeeRewards[msg.sender] += newFeesRewardsForToken;

        checkpointFXDFee[msg.sender] = _totalFXDFeeBalance();
        checkpointTokenFee[msg.sender] = _totalTokenFeeBalance();
    }


    function _withdrawClaimedFees() internal {
        uint256 pendingFXDFee = claimedFXDFeeRewards[msg.sender];
        uint256 pendingTokenFee = claimedTokenFeeRewards[msg.sender];

        uint256 remainingFXDFeeBalanceInStableswap = IStableSwapModule(stableSwapModule).remainingFXDFeeBalance();
        uint256 remainingTokenFeeBalanceInStableswap = IStableSwapModule(stableSwapModule).remainingTokenFeeBalance();
        
        if(pendingFXDFee > remainingFXDFeeBalanceInStableswap){
            pendingFXDFee = remainingFXDFeeBalanceInStableswap;
        }

        if(pendingTokenFee > remainingTokenFeeBalanceInStableswap){
            pendingTokenFee = remainingTokenFeeBalanceInStableswap;
        }
        
        claimedFXDFeeRewards[msg.sender] = 0;
        claimedTokenFeeRewards[msg.sender] = 0;
        
        if(pendingFXDFee > 0 || pendingTokenFee > 0){
            _withdrawFeesFromStableswap(msg.sender, pendingFXDFee, pendingTokenFee);
        }
    }

    function _depositToStableSwap(address _token, uint256 _amount) internal {
        uint256 tokenBalanceBefore = _token.balanceOf(address(this));
        _token.safeApprove(stableSwapModule, 0);
        _token.safeApprove(stableSwapModule, _amount);
        IStableSwapModule(stableSwapModule).depositToken(_token, _amount);
        uint256 tokenBalanceAfter = _token.balanceOf(address(this));
        require(tokenBalanceBefore - tokenBalanceAfter == _amount, "depositToStableSwap/amount-mismatch");
    }

    function _withdrawFromStableSwap(address _token, uint256 _amount) internal {
        uint256 tokenBalanceBefore = _token.balanceOf(address(this));
        IStableSwapModule(stableSwapModule).withdrawToken(_token, _amount);
        uint256 tokenBalanceAfter = _token.balanceOf(address(this));
        require(tokenBalanceAfter - tokenBalanceBefore == _amount, "withdrawFromStableSwap/amount-mismatch");
    }

    function _withdrawFeesFromStableswap(address _destination,uint256 _amountFXDFee, uint256 _amountTokenFee) internal {
        uint256 stablecoinBalanceOfUserBeforeWithdraw = stablecoin.balanceOf(_destination);
        uint256 tokenBalanceOfUserBeforeWithdraw = token.balanceOf(_destination);
        
        IStableSwapModule(stableSwapModule).withdrawFees(_destination,_amountFXDFee, _amountTokenFee);
        uint256 stablecoinBalanceOfUserAfterWithdraw = stablecoin.balanceOf(_destination);
        uint256 tokenBalanceOfUserAfterWithdraw = token.balanceOf(_destination);
        
        require(stablecoinBalanceOfUserAfterWithdraw - stablecoinBalanceOfUserBeforeWithdraw == _amountFXDFee, "withdrawFeesFromStableswap/stablecoin-amount-mismatch");
        require(tokenBalanceOfUserAfterWithdraw - tokenBalanceOfUserBeforeWithdraw == _amountTokenFee, "withdrawFeesFromStableswap/token-amount-mismatch");
    }

    function _transferToTheContract(address _token, uint256 _amount) internal {
        _token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function _transferToUser(address _token, uint256 _amount) internal {
        _token.safeTransfer(msg.sender, _amount);
    }

    function _totalFXDFeeBalance() internal view returns(uint256) {
        return IStableSwapRetriever(stableSwapModule).totalFXDFeeBalance();
    }

    function _totalTokenFeeBalance() internal view returns(uint256) {
        return IStableSwapRetriever(stableSwapModule).totalTokenFeeBalance();
    }

    function _totalStablecoinBalanceStableswap() internal view returns(uint256) {
        return IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
    }

    function _totalTokenBalanceStableswap() internal view returns(uint256) {
        return IStableSwapModule(stableSwapModule).tokenBalance(token);
    }

    function _convertDecimals(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10 ** (_toDecimals - _fromDecimals)) : _amount / (10 ** (_fromDecimals - _toDecimals));
    }
}
