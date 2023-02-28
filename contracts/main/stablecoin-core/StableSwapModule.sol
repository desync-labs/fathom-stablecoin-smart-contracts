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

    mapping(address => uint256) public tokenBalance;

    uint256 public feeIn; // fee in [wad]
    uint256 public feeOut; // fee out [wad]
    uint256 public lastUpdate;

    uint256 public remainingDailySwapAmount; // [wad]
    uint256 public dailySwapLimit; // [wad]
    uint256 public totalTokenFeeBalance; // [wad]
    uint256 public totalFXDFeeBalance; // [wad]

    uint256 public constant ONE_DAY = 86400;
    uint256 public constant MINIMUM_DAILY_SWAP_LIMIT = 1000 * 1e18;

    event LogSetFeeIn(address indexed _caller, uint256 _feeIn);
    event LogSetFeeOut(address indexed _caller, uint256 _feeOut);
    event LogSwapTokenToStablecoin(address indexed _owner, uint256 _value, uint256 _fee);
    event LogSwapStablecoinToToken(address indexed _owner, uint256 _value, uint256 _fee);
    event LogDailySwapLimitUpdate(uint256 _newDailySwapLimit, uint256 _oldDailySwapLimit);
    event LogDepositToken(address indexed _owner, address indexed _token, uint256 _value);
    event LogWithdrawFees(address indexed _destination, uint256 _stablecoinFee, uint256 _tokenFee);
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

    function initialize(
        address _bookKeeper,
        address _token,
        address _stablecoin,
        uint256 _dailySwapLimit
    ) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        require(_dailySwapLimit >= MINIMUM_DAILY_SWAP_LIMIT, "initialize/less-than-minimum-daily-swap-limit");
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = _stablecoin;
        token = _token;
        dailySwapLimit = _dailySwapLimit;
    }

    uint256 constant WAD = 10**18;

    function setDailySwapLimit(uint256 newdailySwapLimit) external onlyOwner {
        require(newdailySwapLimit >= MINIMUM_DAILY_SWAP_LIMIT, "StableSwapModule/less-than-minimum-daily-swap-limit");
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

    function swapTokenToStablecoin(address _usr, uint256 _amount) external override nonReentrant whenNotPaused {
        require(_amount != 0, "StableSwapModule/amount-zero");

        uint256 tokenAmount18 = _convertDecimals(_amount, IToken(token).decimals(), 18);
        uint256 fee = (tokenAmount18 * feeIn) / WAD;
        uint256 stablecoinAmount = tokenAmount18 - fee;
        require(tokenBalance[stablecoin] >= stablecoinAmount, "swapTokenToStablecoin/not-enough-stablecoin-balance");

        _udpateAndCheckDailyLimit(tokenAmount18);

        tokenBalance[stablecoin] -= stablecoinAmount;
        tokenBalance[token] += _amount;
        totalFXDFeeBalance += fee;

        token.safeTransferFrom(msg.sender, address(this), _amount);
        stablecoin.safeTransfer(_usr, stablecoinAmount);
        emit LogSwapTokenToStablecoin(_usr, _amount, fee);
    }

    function swapStablecoinToToken(address _usr, uint256 _amount) external override nonReentrant whenNotPaused {
        require(_amount != 0, "StableSwapModule/amount-zero");
        
        uint256 fee = (_amount * feeOut) / WAD;
        uint256 tokenAmount = _convertDecimals(_amount - fee, 18, IToken(token).decimals());

        require(tokenBalance[token] >= tokenAmount, "swapStablecoinToToken/not-enough-token-balance");

        _udpateAndCheckDailyLimit(_amount);

        tokenBalance[token] -= tokenAmount;
        tokenBalance[stablecoin] += _amount;
        totalTokenFeeBalance += fee;

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
            remainingDailySwapAmount = dailySwapLimit;
        }
        require(remainingDailySwapAmount >= _amount, "_udpateAndCheckDailyLimit/daily-limit-exceeded");
        remainingDailySwapAmount -= _amount;
        emit LogRemainingDailySwapAmount(remainingDailySwapAmount);
    }

    function _convertDecimals(
        uint256 _amount,
        uint8 _fromDecimals,
        uint8 _toDecimals
    ) internal returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10**(_toDecimals - _fromDecimals)) : _amount / (10**(_fromDecimals - _toDecimals));
    }
}
