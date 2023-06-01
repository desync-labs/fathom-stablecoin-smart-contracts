// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
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
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
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

    function initialize(
        address _bookKeeper,
        address _stableswapModule
    ) external initializer {
        require(AddressUpgradeable.isContract(_stableswapModule),"stableswapModule-not-contract");
        require(AddressUpgradeable.isContract(_bookKeeper),"bookkeeper-not-contract");

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

    function setIsDecentralizedState(bool _isDecentralizedState) external onlyOwner{
        isDecentralizedState = _isDecentralizedState;
        emit LogUpdateIsDecentralizedState(isDecentralizedState);
    }

    /**
     * @dev _amount arg should be in 18 decimals
     * @dev when you deposit tokens, you are depositing _amount of Stablecoin and Token each
     * @dev so, the total deposit is twice the _amount    
     */
    function depositTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized{
        require(_amount != 0, "wrapper-depositTokens/amount-zero");
        uint256 _amountScaled = _convertDecimals(_amount, 18, IToken(token).decimals());
        require(IToken(token).balanceOf(msg.sender) >= _amountScaled, "depositTokens/token-not-enough");
        require(IToken(stablecoin).balanceOf(msg.sender) >= _amount, "depositTokens/FXD-not-enough");
        
        _transferToTheContract(stablecoin, _amount);
        _transferToTheContract(token, _amountScaled);

        depositTracker[msg.sender] += 2 * _amount;
        totalValueDeposited += 2 * _amount;

        checkpointFXDFee[msg.sender] = _totalFXDFeeBalance();
        checkpointTokenFee[msg.sender] = _totalTokenFeeBalance();
        
        _depositToStableSwap(stablecoin, _amount);
        _depositToStableSwap(token, _amountScaled);

            emit LogDepositTokens(msg.sender, _amount);
    }

    /**
     * @dev _amount arg should be in 18 decimals
     * @dev when you withdraw tokens, you are withdrawing _amount of total tokens , ie half of stablecoin and half of token
     * @dev please consider that the withdraw of each token is not exactly half but depends upon ratio of tokens in the stableswap
     */
    function withdrawTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized{
        require(_amount != 0, "withdrawTokens/amount-zero");
        require(depositTracker[msg.sender] >= _amount, "withdrawTokens/amount-exceeds-users-deposit");
        require(totalValueDeposited >= _amount , "withdrawTokens/amount-exceeds-total-deposit");
        
        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);
       
        require(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals >= _amount, 
                "withdrawTokens/amount-exceed-total-balance-in-stableswap");

        uint256 stablecoinAmountToWithdraw = 
                    _amount * WAD * stablecoinBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) 
                    / WAD;


        uint256 tokenAmountToWithdraw = 
                    _amount * WAD * tokenBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals)
                    /WAD;
        

        require(stablecoinAmountToWithdraw + tokenAmountToWithdraw <= _amount, "withdrawTokens/total-amount-from-stableswap-exceeds-amount");
        uint256 tokenAmountToWithdrawScaled = _convertDecimals(tokenAmountToWithdraw, 18, IToken(token).decimals());
        
        _withdrawFromStableSwap(stablecoin, stablecoinAmountToWithdraw);
        _withdrawFromStableSwap(token, tokenAmountToWithdrawScaled);

        depositTracker[msg.sender] -= _amount;
        totalValueDeposited -= _amount;

        checkpointFXDFee[msg.sender] = _totalFXDFeeBalance();
        checkpointTokenFee[msg.sender] = _totalTokenFeeBalance();

        _transferToUser(stablecoin, stablecoinAmountToWithdraw);
        _transferToUser(token, tokenAmountToWithdrawScaled);

        emit LogWithdrawTokens(msg.sender, _amount);
    }

    function claimRewards() external {
        uint256 totalLiquidity = IStableSwapRetriever(stableSwapModule).totalValueLocked();
        uint256 providerLiquidity = depositTracker[msg.sender]/2;

        uint256 newFeesForFXD = _totalFXDFeeBalance() - checkpointFXDFee[msg.sender];
        uint256 newFeesForToken = _totalTokenFeeBalance()- checkpointTokenFee[msg.sender];

        uint256 rewardsFXD = (newFeesForFXD * providerLiquidity) / totalLiquidity;
        uint256 rewardsToken = (newFeesForToken * providerLiquidity) / totalLiquidity;

        checkpointFXDFee[msg.sender] = _totalFXDFeeBalance();
        checkpointTokenFee[msg.sender] = _totalTokenFeeBalance();

        // Transfer `rewards` to msg.sender.
        _withdrawFeesFromStableswap(rewardsFXD);
        _withdrawFeesFromStableswap(rewardsToken);
    }


    function pause() external onlyOwnerOrGov {
        _pause();
        emit LogStableSwapWrapperPauseState(true);
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        emit LogStableSwapWrapperPauseState(false);
    }

    function getAmounts(uint256 _amount) external override view returns(uint256, uint256) {
        require(_amount != 0, "getAmounts/amount-zero");
        require(depositTracker[msg.sender] >= _amount, "getAmounts/amount-exceeds-users-deposit");
        require(totalValueDeposited >= _amount , "getAmounts/amount-exceeds-total-deposit");

        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);
       
        uint256 stablecoinAmountToWithdraw = 
                    _amount * WAD * stablecoinBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) 
                    / WAD;

        uint256 tokenAmountToWithdraw = 
                    _amount * WAD * tokenBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals)
                    /WAD;

        return (stablecoinAmountToWithdraw, tokenAmountToWithdraw);
    }

    function getActualLiquidityAvailablePerUser(address account) external override view returns(uint256, uint256) {
        uint256 _amount = depositTracker[account];
        uint256 stablecoinBalanceStableSwap18Decimals = IStableSwapModule(stableSwapModule).tokenBalance(stablecoin);
        uint256 tokenBalanceStableSwapScaled = IStableSwapModule(stableSwapModule).tokenBalance(token);
        uint256 tokenBalanceStableSwap18Decimals = _convertDecimals(tokenBalanceStableSwapScaled, IToken(token).decimals(), 18);
       
        uint256 stablecoinAmountToWithdraw = 
                    _amount * WAD * stablecoinBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals) 
                    / WAD;

        uint256 tokenAmountToWithdraw = 
                    _amount * WAD * tokenBalanceStableSwap18Decimals
                    /(stablecoinBalanceStableSwap18Decimals + tokenBalanceStableSwap18Decimals)
                    /WAD;

        return (stablecoinAmountToWithdraw, tokenAmountToWithdraw);
    }

    function _depositToStableSwap(address _token, uint256 _amount) internal {
        uint256 tokenBalanceBefore = _token.balanceOf(address(this));
        _token.safeApprove(stableSwapModule, 0);
        _token.safeApprove(stableSwapModule, _amount);
        IStableSwapModule(stableSwapModule).depositToken(_token, _amount);
        uint256 tokenBalanceAfter = _token.balanceOf(address(this));
        require(tokenBalanceBefore -  tokenBalanceAfter == _amount, "depositToStableSwap/amount-mismatch");
    }

    function _withdrawFromStableSwap(address _token, uint256 _amount) internal {
        uint256 tokenBalanceBefore = _token.balanceOf(address(this));
        IStableSwapModule(stableSwapModule).withdrawToken(_token, _amount);
        uint256 tokenBalanceAfter = _token.balanceOf(address(this));
        require(tokenBalanceAfter - tokenBalanceBefore == _amount, "withdrawFromStableSwap/amount-mismatch");
    }

    function _withdrawFeesFromStableswap(uint256 _amount) internal {
        //TODO
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

    function _convertDecimals(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10 ** (_toDecimals - _fromDecimals)) : _amount / (10 ** (_fromDecimals - _toDecimals));
    }
}
