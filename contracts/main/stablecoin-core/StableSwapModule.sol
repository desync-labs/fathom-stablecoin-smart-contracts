// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IStablecoin.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IAuthTokenAdapter.sol";
import "../interfaces/IStableSwapModule.sol";
import "../utils/SafeToken.sol";

// Stable Swap Module
// Allows anyone to go between FUSD and the Token by pooling the liquidity
// An optional fee is charged for incoming and outgoing transfers
contract StableSwapModule is PausableUpgradeable, ReentrancyGuardUpgradeable, IStableSwapModule {
    using SafeToken for address;

    IBookKeeper public bookKeeper;
    IStablecoin public stablecoin;
    address public token;
    
    uint256 internal to18ConversionFactor;
    mapping(address => uint256) public tokenBalance;

    uint256 public feeIn; // fee in [wad]
    uint256 public feeOut; // fee out [wad]
    uint256 public lastUpdate;

    uint256 public remainingDailySwapAmount;
    uint256 public dailySwapLimit;

    uint256 public totalFeeBalance;

    uint256 public constant ONE_DAY = 86400;
    uint256 public constant MINIMUM_DAILY_SWAP_LIMIT = 1000*1e18;


    event LogSetFeeIn(address indexed _caller, uint256 _feeIn);
    event LogSetFeeOut(address indexed _caller, uint256 _feeOut);
    event LogSwapTokenToStablecoin(address indexed _owner, uint256 _value, uint256 _fee);
    event LogSwapStablecoinToToken(address indexed _owner, uint256 _value, uint256 _fee);
    event LogDailySwapLimitUpdate(uint256 _newDailySwapLimit, uint256 _oldDailySwapLimit);
    event LogDepositToken(address indexed _owner, address indexed _token, uint256 _value);
    event LogWithdrawFees(address indexed _account, uint256 _fees);
    event LogRemainingDailySwapAmount(uint256 _remainingDailySwapAmount);
    event LogStableSwapPauseState(bool _pauseState);
    event LogEmergencyWithdraw(address indexed _account);

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

    function initialize(address _bookKeeper,address _token, address _stablecoin, uint256 _dailySwapLimit) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        require(_dailySwapLimit >= MINIMUM_DAILY_SWAP_LIMIT,"initialize/less-than-minimum-daily-swap-limit");
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = IStablecoin(_stablecoin);
        token = _token;
        dailySwapLimit = _dailySwapLimit;
        to18ConversionFactor = 10 ** (18 - stablecoin.decimals());
        
    }

    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x);
    }

    function setDailySwapLimit(uint256 newdailySwapLimit) external onlyOwner {
        require(newdailySwapLimit >= MINIMUM_DAILY_SWAP_LIMIT,"initialize/less-than-minimum-daily-swap-limit");
        emit LogDailySwapLimitUpdate(newdailySwapLimit, dailySwapLimit);
        dailySwapLimit = newdailySwapLimit;
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

    
    function swapTokenToStablecoin(address _usr,uint256 _tokenAmount) external override nonReentrant whenNotPaused {
        require(_tokenAmount != 0, "StableSwapModule/amount-zero");
        
        uint256 _tokenAmount18 = mul(_tokenAmount, to18ConversionFactor);
        uint256 _fee = mul(_tokenAmount18, feeIn) / WAD;
        uint256 _stablecoinAmount = sub(_tokenAmount18, _fee);
        
        require(tokenBalance[address(stablecoin)] >= _stablecoinAmount, "swapTokenToStablecoin/not-enough-stablecoin-balance");
        
        _udpateAndCheckDailyLimit(_tokenAmount);
        
        tokenBalance[address(stablecoin)] = sub(tokenBalance[address(stablecoin)], _stablecoinAmount);
        tokenBalance[address(token)] = add(tokenBalance[address(token)], _tokenAmount);
        totalFeeBalance += _fee;
        
        token.safeTransferFrom(msg.sender, address(this), _tokenAmount);
        address(stablecoin).safeTransfer(_usr, _stablecoinAmount);
        emit LogSwapTokenToStablecoin(_usr, _tokenAmount, _fee);
    }
    

    function swapStablecoinToToken(address _usr,uint256 _tokenAmount) external override nonReentrant whenNotPaused {
        require(_tokenAmount != 0, "StableSwapModule/amount-zero");
        uint256 _tokenAmount18 = mul(_tokenAmount, to18ConversionFactor);
        uint256 _fee = mul(_tokenAmount18, feeOut) / WAD;
        uint256 _stablecoinAmount = add(_tokenAmount18, _fee);
        
        require(tokenBalance[address(token)] >= _tokenAmount,"swapStablecoinToToken/not-enough-token-balance");
        
        _udpateAndCheckDailyLimit(_tokenAmount);
        
        tokenBalance[address(token)] = sub(tokenBalance[address(token)], _tokenAmount);
        tokenBalance[address(stablecoin)] = add(tokenBalance[address(stablecoin)], _stablecoinAmount);
        totalFeeBalance += _fee;
        
        address(stablecoin).safeTransferFrom(msg.sender, address(this), _stablecoinAmount);
        token.safeTransfer(_usr, _tokenAmount);
        emit LogSwapStablecoinToToken(_usr, _tokenAmount, _fee);
    }

    function depositToken(address _token,uint256 _amount) external override nonReentrant whenNotPaused onlyOwnerOrGov{
        require(address(_token).balanceOf(msg.sender) >= _amount,"depositStablecoin/not-enough-stablecoin-balance");
        tokenBalance[address(_token)] = add(tokenBalance[address(stablecoin)], _amount);
        _token.safeTransferFrom(msg.sender,address(this), _amount);
        emit LogDepositToken(msg.sender, _token, _amount);
    }

    function withdrawFees(address _account) external override nonReentrant onlyOwnerOrGov{
        require(_account!= address(0),"withdrawFees/empty-account");
        require(totalFeeBalance!=0,"withdrawFees/no-fee-balance");
        uint256 pendingFeeBalance = totalFeeBalance;
        totalFeeBalance = 0;
        address(stablecoin).safeTransfer(_account,  pendingFeeBalance);
        emit LogWithdrawFees(_account, pendingFeeBalance);
    }   

    function pause() external onlyOwnerOrGov {
        _pause();
        emit LogStableSwapPauseState(true);
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        emit LogStableSwapPauseState(false);
    }

    function emergencyWithdraw(address _account) external override nonReentrant onlyOwnerOrGov{
        require(paused(),"emergencyWithdraw/not-paused");
        tokenBalance[address(token)] = 0;
        tokenBalance[address(stablecoin)] = 0;
        token.safeTransfer(_account, token.balanceOf(address(this)));
        address(stablecoin).safeTransfer(_account, address(stablecoin).balanceOf(address(this)));
        emit LogEmergencyWithdraw(_account);
    }

    function _udpateAndCheckDailyLimit(uint256 _amount) internal {
        if(block.timestamp - lastUpdate >= ONE_DAY){
            lastUpdate = block.timestamp;
            remainingDailySwapAmount= dailySwapLimit;
        }
        require(remainingDailySwapAmount >= _amount,"_udpateAndCheckDailyLimit/daily-limit-exceeded");
        remainingDailySwapAmount -= _amount;
        emit LogRemainingDailySwapAmount(remainingDailySwapAmount);
    }
    
}
