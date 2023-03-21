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

// Stable Swap Module
// Allows anyone to go between FUSD and the Token by pooling the liquidity
// An optional fee is charged for incoming and outgoing transfers
contract StableSwapModule is PausableUpgradeable, ReentrancyGuardUpgradeable, IStableSwapModule {
    using SafeToken for address;

    IBookKeeper public bookKeeper;
    address public stablecoin;
    address public token;
    bool public isDecentralizedState;
    mapping(address => uint256) public tokenBalance;

    uint256 public feeIn; // fee in [wad]
    uint256 public feeOut; // fee out [wad]
    uint256 public lastUpdate;

    uint256 public remainingDailySwapAmount; // [wad]
    uint256 public dailySwapLimitNumerator; // 10000th
    uint256 public singleSwapLimitNumerator; // 10000th
    uint256 public totalTokenFeeBalance; // [wad]
    uint256 public totalFXDFeeBalance; // [wad]

    uint256 public constant ONE_DAY = 86400;
    uint256 public constant MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR = 200;
    uint256 public constant MINIMUM_SINGLE_SWAP_LIMIT_WEIGHT = 50;

    uint256 constant WAD = 10**18;
    
    mapping(address => bool) usersWhitelist;
    mapping(address => uint256) pastUserSwapBlockTime;

    event LogSetFeeIn(address indexed _caller, uint256 _feeIn);
    event LogSetFeeOut(address indexed _caller, uint256 _feeOut);
    event LogSwapTokenToStablecoin(address indexed _owner, uint256 _value, uint256 _fee);
    event LogSwapStablecoinToToken(address indexed _owner, uint256 _value, uint256 _fee);
    event LogDailySwapLimitUpdate(uint256 _newDailySwapLimit, uint256 _oldDailySwapLimit);
    event LogSingleSwapLimitUpdate(uint256 _newSingleSwapLimit, uint256 _oldSingleSwapLimit);
    event LogDepositToken(address indexed _owner, address indexed _token, uint256 _value);
    event LogWithdrawFees(address indexed _destination, uint256 _stablecoinFee, uint256 _tokenFee);
    event LogRemainingDailySwapAmount(uint256 _remainingDailySwapAmount);
    event LogStableSwapPauseState(bool _pauseState);
    event LogEmergencyWithdraw(address indexed _account);
    event LogDecentralizedStateStatus(bool _oldDecentralizedStateStatus, bool _newDecentralizedStateStatus);
    event LogAddToWhitelist(address indexed user);
    event LogRemoveFromWhitelist(address indexed user);

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

    function initialize(
        address _bookKeeper,
        address _token,
        address _stablecoin,
        uint256 _dailySwapLimitNumerator,
        uint256 _singleSwapLimitNumerator,
        address[] calldata whitelistedUsers
    ) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        require(_dailySwapLimitNumerator >= MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR, "initialize/less-than-minimum-daily-swap-limit");
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = _stablecoin;
        token = _token;
        dailySwapLimitNumerator = _dailySwapLimitNumerator;
        singleSwapLimitNumerator = _singleSwapLimitNumerator;
        for(uint i;i<whitelistedUsers.length;i++){
            if(whitelistedUsers[i] != address(0)){
                usersWhitelist[whitelistedUsers[i]] = true;
                emit LogAddToWhitelist(whitelistedUsers[i]);
            }
        }
    }

    function setDailySwapLimitNumerator(uint256 newdailySwapLimitNumerator) external onlyOwner {
        require(newdailySwapLimitNumerator <= dailySwapLimitDenominator(),"StableSwapModule/numerator-over-denominator");
        require(newdailySwapLimitNumerator >= MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR, "StableSwapModule/less-than-minimum-daily-swap-limit");
        emit LogDailySwapLimitUpdate(newdailySwapLimitNumerator, dailySwapLimitNumerator);
        dailySwapLimitNumerator = newdailySwapLimitNumerator;
        remainingDailySwapAmount = _dailySwapLimit();
    }

    function setSingleSwapLimitWeight(uint256 newSingleSwapLimitWeight) external onlyOwner {
        require(newSingleSwapLimitWeight <= singleSwapLimitDenominator(),"StableSwapModule/numerator-over-denominator");
        require(newSingleSwapLimitWeight >= MINIMUM_SINGLE_SWAP_LIMIT_WEIGHT, "StableSwapModule/less-than-minimum-single-swap-limit");
        emit LogSingleSwapLimitUpdate(newSingleSwapLimitWeight, singleSwapLimitNumerator);
        singleSwapLimitNumerator = newSingleSwapLimitWeight;
        remainingDailySwapAmount = _dailySwapLimit();
    }

    function setFeeIn(uint256 _feeIn) external onlyOwner {
        require(_feeIn <= 5 * 1e17, "StableSwapModule/invalid-fee-in"); // Max feeIn is 0.5 Ethers or 50%
        feeIn = _feeIn;
        emit LogSetFeeIn(msg.sender, _feeIn);
    }

    function setFeeOut(uint256 _feeOut) external onlyOwner {
        require(_feeOut <= 5 * 1e17, "StableSwapModule/invalid-fee-out"); // Max feeOut is 0.5 Ethers or 50%
        feeOut = _feeOut;
        emit LogSetFeeOut(msg.sender, _feeOut);
    }

    function setDecentralizedStatesStatus(bool _status) external onlyOwner{
        isDecentralizedState = _status;
        emit LogDecentralizedStateStatus(isDecentralizedState, _status);
    }

    function addToWhitelist(address _user) external onlyOwner{
        usersWhitelist[_user] = true;
        emit LogAddToWhitelist(_user);
    }

    function removeFromWhitelist(address _user) external onlyOwner{
        usersWhitelist[_user] = false;
        emit LogRemoveFromWhitelist(_user);
    }

    function swapTokenToStablecoin(address _usr, uint256 _amount) external override whenNotPaused onlyWhitelistedIfNotDecentralized(msg.sender) nonReentrant  {
        require(_amount != 0, "StableSwapModule/amount-zero");

        uint256 tokenAmount18 = _convertDecimals(_amount, IToken(token).decimals(), 18);
        uint256 fee = (tokenAmount18 * feeIn) / WAD;
        uint256 stablecoinAmount = tokenAmount18 - fee;
        require(tokenBalance[stablecoin] >= stablecoinAmount, "swapTokenToStablecoin/not-enough-stablecoin-balance");
        
        if(isDecentralizedState){
            _checkSingleSwapLimit(tokenAmount18);
            _udpateAndCheckDailyLimit(tokenAmount18);
            _checkAndUpdateOneSwapPerBlock(msg.sender);
        }

        tokenBalance[stablecoin] -= stablecoinAmount;
        tokenBalance[token] += _amount;
        totalFXDFeeBalance += fee;

        token.safeTransferFrom(msg.sender, address(this), _amount);
        stablecoin.safeTransfer(_usr, stablecoinAmount);
        emit LogSwapTokenToStablecoin(_usr, _amount, fee);
    }

    function swapStablecoinToToken(address _usr, uint256 _amount) external override whenNotPaused onlyWhitelistedIfNotDecentralized(msg.sender) nonReentrant  {
        require(_amount != 0, "StableSwapModule/amount-zero");
        
        uint256 fee = (_amount * feeOut) / WAD;
        uint256 tokenAmount = _convertDecimals(_amount - fee, 18, IToken(token).decimals());
        
        require(tokenBalance[token] >= tokenAmount, "swapStablecoinToToken/not-enough-token-balance");
        
        if(isDecentralizedState){
            _checkSingleSwapLimit(_amount);
            _udpateAndCheckDailyLimit(_amount);
            _checkAndUpdateOneSwapPerBlock(msg.sender);
        }

        tokenBalance[token] -= tokenAmount;
        tokenBalance[stablecoin] += _amount;
        totalTokenFeeBalance += _convertDecimals(fee, 18, IToken(token).decimals());

        stablecoin.safeTransferFrom(msg.sender, address(this), _amount);
        token.safeTransfer(_usr, tokenAmount);
        emit LogSwapStablecoinToToken(_usr, _amount, fee);
    }

    function depositToken(address _token, uint256 _amount) external override nonReentrant whenNotPaused onlyOwnerOrGov {
        require(_token == token || _token == stablecoin, "depositStablecoin/invalid-token");
        require(_amount != 0, "depositStablecoin/amount-zero");
        require(_token.balanceOf(msg.sender) >= _amount, "depositStablecoin/not-enough-balance");
        tokenBalance[_token] += _amount;
        _token.safeTransferFrom(msg.sender, address(this), _amount);
        remainingDailySwapAmount = _dailySwapLimit();
        emit LogDepositToken(msg.sender, _token, _amount);
    }

    function withdrawFees(address _destination) external override nonReentrant onlyOwnerOrGov {
        require(_destination != address(0), "withdrawFees/wrong-destination");
        require(totalFXDFeeBalance != 0 || totalTokenFeeBalance != 0, "withdrawFees/no-fee-balance");
        uint256 pendingFXDBalance = totalFXDFeeBalance;
        if(pendingFXDBalance !=0) {
            totalFXDFeeBalance = 0;
            stablecoin.safeTransfer(_destination, pendingFXDBalance);
        }
        uint256 pendingTokenBalance = totalTokenFeeBalance;
        if(pendingTokenBalance !=0) {
            totalTokenFeeBalance = 0;
            token.safeTransfer(_destination, pendingTokenBalance);
        }

        emit LogWithdrawFees(_destination, pendingFXDBalance, pendingTokenBalance);
    }

    function pause() external onlyOwnerOrGov {
        _pause();
        emit LogStableSwapPauseState(true);
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        emit LogStableSwapPauseState(false);
    }

    function emergencyWithdraw(address _account) external override nonReentrant onlyOwnerOrGov whenPaused {
        require(_account != address(0), "withdrawFees/empty-account");
        tokenBalance[token] = 0;
        tokenBalance[stablecoin] = 0;
        token.safeTransfer(_account, token.balanceOf(address(this)));
        stablecoin.safeTransfer(_account, stablecoin.balanceOf(address(this)));
        emit LogEmergencyWithdraw(_account);
    }

    function _udpateAndCheckDailyLimit(uint256 _amount) internal {
        if (block.timestamp - lastUpdate >= ONE_DAY) {
            lastUpdate = block.timestamp;
            remainingDailySwapAmount = _dailySwapLimit();
        }
        require(remainingDailySwapAmount >= _amount, "_udpateAndCheckDailyLimit/daily-limit-exceeded");
        remainingDailySwapAmount -= _amount;
        emit LogRemainingDailySwapAmount(remainingDailySwapAmount);
    }

    function _checkSingleSwapLimit(uint256 _amount) view internal {
        require(_amount<= TotalValueLocked() * singleSwapLimitNumerator / singleSwapLimitDenominator(),
                "_checkSingleSwapLimit/single-swap-exceeds-limit");
    }

    function _dailySwapLimit() internal view returns (uint256){
        uint256 newDailySwapLimit = TotalValueLocked() * dailySwapLimitNumerator/dailySwapLimitDenominator();
        return newDailySwapLimit;
    }

    function _checkAndUpdateOneSwapPerBlock(address account) internal {
        require(pastUserSwapBlockTime[account]!=block.timestamp,'one-block-swap-limit-exceeded');
        pastUserSwapBlockTime[account] = block.timestamp;
    }

    function TotalValueLocked() public view returns(uint256) {
        return tokenBalance[stablecoin] + _convertDecimals(tokenBalance[token], IToken(token).decimals(),18);
    }

    function dailySwapLimitDenominator() public pure returns (uint256){
        return 10000;
    }

    function singleSwapLimitDenominator() public pure returns (uint256){
        return 10000;
    }

    function _convertDecimals(
        uint256 _amount,
        uint8 _fromDecimals,
        uint8 _toDecimals
    ) internal pure returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10**(_toDecimals - _fromDecimals)) : _amount / (10**(_fromDecimals - _toDecimals));
    }
    

    modifier onlyWhitelistedIfNotDecentralized(
        address _account
    ){
        if(!isDecentralizedState){
            require(usersWhitelist[_account],"user-not-whitelisted");
        }
        _;
    }
}
