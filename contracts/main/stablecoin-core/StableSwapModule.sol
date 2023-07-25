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
import "../interfaces/IStableSwapModuleWrapperRetriever.sol";

// Stable Swap Module
// Allows anyone to go between FUSD and the Token by pooling the liquidity
// An optional fee is charged for incoming and outgoing transfers
contract StableSwapModule is PausableUpgradeable, ReentrancyGuardUpgradeable, IStableSwapModule {
    using SafeToken for address;

    uint256 public constant ONE_DAY = 86400;
    uint256 internal constant WAD = 10 ** 18;

    IBookKeeper public bookKeeper;
    address public override stablecoin;
    address public override token;
    bool public isDecentralizedState;
    mapping(address => uint256) public override tokenBalance;

    uint256 public feeIn; // fee in [wad]
    uint256 public feeOut; // fee out [wad]
    uint256 public lastUpdate;

    uint256 public remainingDailySwapAmount; // [wad]
    uint256 public dailySwapLimitNumerator;
    uint256 public singleSwapLimitNumerator;
    uint256 public totalTokenFeeBalance; // 6 decimals
    uint256 public totalFXDFeeBalance; // [wad]
    uint256 public totalValueDeposited;
    uint256 public numberOfSwapsLimitPerUser; // number of swaps per user within a certain block limit set
    uint256 public blocksPerLimit; // number of blocks within which the number of swaps per user is limited

    uint256 public constant DAILY_SWAP_LIMIT_DENOMINATOR = 10000;
    uint256 public constant SINGLE_SWAP_LIMIT_DENOMINATOR = 10000;
    uint256 public constant MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR = 200; //200/10000 = 2%
    uint256 public constant MINIMUM_SINGLE_SWAP_LIMIT_NUMERATOR = 20; //20/10000 = 0.2%
    uint256 public constant MINIMUM_BLOCKS_PER_LIMIT = 1;
    uint256 public constant MINIMUM_NUMBER_OF_SWAPS_LIMIT_PER_USER = 1;

    mapping(address => bool) public usersWhitelist;
    mapping(address => uint256) public numberOfSwapsRemainingPerUserInBlockLimit;
    mapping(address => uint256) public lastSwapBlockNumberPerUser;

    //storage variables after upgrade
    address public stableswapWrapper;
   
    //storage variables after upgrade - 2
    uint256 public override remainingFXDFeeBalance;
    uint256 public override remainingTokenFeeBalance;
    bool public feesUpgradeInitialized;

    event LogSetFeeIn(address indexed _caller, uint256 _feeIn);
    event LogSetFeeOut(address indexed _caller, uint256 _feeOut);
    event LogSwapTokenToStablecoin(address indexed _owner, uint256 _value, uint256 _fee);
    event LogSwapStablecoinToToken(address indexed _owner, uint256 _value, uint256 _fee);
    event LogDailySwapLimitUpdate(uint256 _newDailySwapLimit, uint256 _oldDailySwapLimit);
    event LogSingleSwapLimitUpdate(uint256 _newSingleSwapLimit, uint256 _oldSingleSwapLimit);
    event LogDepositToken(address indexed _owner, address indexed _token, uint256 _value);
    event LogWithdrawFees(address indexed _destination, uint256 _stablecoinFee, uint256 _tokenFee);
    event LogRemainingDailySwapAmount(uint256 _remainingDailySwapAmount);
    event LogEmergencyWithdraw(address indexed _account);
    event LogDecentralizedStateStatus(bool _oldDecentralizedStateStatus, bool _newDecentralizedStateStatus);
    event LogAddToWhitelist(address indexed user);
    event LogRemoveFromWhitelist(address indexed user);
    event LogNumberOfSwapsLimitPerUserUpdate(uint256 _newNumberOfSwapsLimitPerUser, uint256 _oldNumberOfSwapsLimitPerUser);
    event LogBlocksPerLimitUpdate(uint256 _newBlocksPerLimit, uint256 _oldBlocksPerLimit);
    event LogWithdrawToken(address _account, address _token, uint256 _amount);

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

    modifier onlyStableswapWrapper() {
        require(msg.sender == stableswapWrapper, "only-stableswap-wrapper");
        _;
    }

    function initialize(
        address _bookKeeper,
        address _token,
        address _stablecoin,
        uint256 _dailySwapLimitNumerator,
        uint256 _singleSwapLimitNumerator,
        uint256 _numberOfSwapsLimitPerUser,
        uint256 _blocksPerLimit
    ) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        require(_dailySwapLimitNumerator >= MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR, "initialize/less-than-minimum-daily-swap-limit");
        require(_singleSwapLimitNumerator >= MINIMUM_SINGLE_SWAP_LIMIT_NUMERATOR, "initialize/less-than-minimum-single-swap-limit");
        require(_numberOfSwapsLimitPerUser >= MINIMUM_NUMBER_OF_SWAPS_LIMIT_PER_USER, "initialize/less-than-minimum-number-of-swaps-limit-per-user");
        require(_blocksPerLimit >= MINIMUM_BLOCKS_PER_LIMIT, "initialize/less-than-minimum-blocks-per-limit");

        require(_bookKeeper != address(0), "initialize/zero-book-keeper");
        require(_stablecoin != address(0), "initialize/zero-stablecoin");
        require(_token != address(0), "initialize/zero-token");

        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = _stablecoin;
        token = _token;
        dailySwapLimitNumerator = _dailySwapLimitNumerator;
        singleSwapLimitNumerator = _singleSwapLimitNumerator;
        numberOfSwapsLimitPerUser = _numberOfSwapsLimitPerUser;
        blocksPerLimit = _blocksPerLimit;
    }

    /**
     * @notice the function is to be called by the owner to initialize the fees after upgrade
     */
    function initializeFeesAfterUpgrade() external onlyOwner{
        require(feesUpgradeInitialized != true, "StableSwapModule/already-initialized");
        feesUpgradeInitialized = true;
        remainingFXDFeeBalance = totalFXDFeeBalance;
        remainingTokenFeeBalance = totalTokenFeeBalance;
    }
    /**
     * @notice the function is to only mitigate the bad storage after upgrade.
     */
    function udpateTotalValueDeposited() external onlyOwner {
        uint256 newTotalValueDeposited = IStableSwapModuleWrapperRetriever(stableswapWrapper).totalValueDeposited();
        totalValueDeposited = newTotalValueDeposited - (totalFXDFeeBalance + _convertDecimals(totalTokenFeeBalance, IToken(token).decimals(), 18));
    }

    function setStableSwapWrapper(address newStableSwapWrapper) external onlyOwner {
        require(AddressUpgradeable.isContract(newStableSwapWrapper), "StableSwapModule/not-contract");
        stableswapWrapper = newStableSwapWrapper;
    }

    function setDailySwapLimitNumerator(uint256 newdailySwapLimitNumerator) external onlyOwner {
        require(newdailySwapLimitNumerator <= DAILY_SWAP_LIMIT_DENOMINATOR, "StableSwapModule/numerator-over-denominator");
        require(newdailySwapLimitNumerator >= MINIMUM_DAILY_SWAP_LIMIT_NUMERATOR, "StableSwapModule/less-than-minimum-daily-swap-limit");
        emit LogDailySwapLimitUpdate(newdailySwapLimitNumerator, dailySwapLimitNumerator);
        dailySwapLimitNumerator = newdailySwapLimitNumerator;
        if (isDecentralizedState) {
            lastUpdate = block.timestamp;
            remainingDailySwapAmount = _dailySwapLimit();
        }
    }

    function setSingleSwapLimitNumerator(uint256 newSingleSwapLimitNumerator) external onlyOwner {
        require(newSingleSwapLimitNumerator <= SINGLE_SWAP_LIMIT_DENOMINATOR, "StableSwapModule/numerator-over-denominator");
        require(newSingleSwapLimitNumerator >= MINIMUM_SINGLE_SWAP_LIMIT_NUMERATOR, "StableSwapModule/less-than-minimum-single-swap-limit");
        emit LogSingleSwapLimitUpdate(newSingleSwapLimitNumerator, singleSwapLimitNumerator);
        singleSwapLimitNumerator = newSingleSwapLimitNumerator;
    }

    function setNumberOfSwapsLimitPerUser(uint256 newNumberOfSwapsLimitPerUser) external onlyOwner {
        require(
            newNumberOfSwapsLimitPerUser >= MINIMUM_NUMBER_OF_SWAPS_LIMIT_PER_USER,
            "StableSwapModule/less-than-minimum-number-of-swaps-limit-per-user"
        );
        emit LogNumberOfSwapsLimitPerUserUpdate(newNumberOfSwapsLimitPerUser, numberOfSwapsLimitPerUser);
        numberOfSwapsLimitPerUser = newNumberOfSwapsLimitPerUser;
    }

    function setBlocksPerLimit(uint256 newBlocksPerLimit) external onlyOwner {
        require(newBlocksPerLimit >= MINIMUM_BLOCKS_PER_LIMIT, "StableSwapModule/less-than-minimum-blocks-per-limit");
        emit LogBlocksPerLimitUpdate(newBlocksPerLimit, blocksPerLimit);
        blocksPerLimit = newBlocksPerLimit;
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

    function setDecentralizedStatesStatus(bool _status) external onlyOwner {
        emit LogDecentralizedStateStatus(isDecentralizedState, _status);
        isDecentralizedState = _status;
    }

    function addToWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = true;
        emit LogAddToWhitelist(_user);
    }

    function removeFromWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = false;
        emit LogRemoveFromWhitelist(_user);
    }
    
    /**
    * @dev the function is to be called by the stableswap wrapper to swap tokens to stablecoin
    * @param _usr the address of the user that receives the stablecoin
    * @param _amount the amount of tokens to be swapped
    */
    function swapTokenToStablecoin(address _usr, uint256 _amount) external override whenNotPaused onlyWhitelistedIfNotDecentralized nonReentrant {
        require(_amount != 0, "StableSwapModule/amount-zero");

        uint256 tokenAmount18 = _convertDecimals(_amount, IToken(token).decimals(), 18);
        uint256 fee = (tokenAmount18 * feeIn) / WAD;
        uint256 stablecoinAmount = tokenAmount18 - fee;
        require(tokenBalance[stablecoin] >= stablecoinAmount, "swapTokenToStablecoin/not-enough-stablecoin-balance");

        if (isDecentralizedState) {
            _checkSingleSwapLimit(tokenAmount18);
            _updateAndCheckDailyLimit(tokenAmount18);
            _updateAndCheckNumberOfSwapsInBlocksPerLimit();
        }

        tokenBalance[stablecoin] -= tokenAmount18;
        tokenBalance[token] += _amount;
        
        totalFXDFeeBalance += fee;
        remainingFXDFeeBalance += fee;

        totalValueDeposited -= fee;

        token.safeTransferFrom(msg.sender, address(this), _amount);
        stablecoin.safeTransfer(_usr, stablecoinAmount);
        emit LogSwapTokenToStablecoin(_usr, _amount, fee);
    }

    /**
    * @dev the function is to be called by the stableswap wrapper to swap stablecoin to tokens
    * @param _usr the address of the user that receives the tokens
    * @param _amount the amount of stablecoin to be swapped
    */
    function swapStablecoinToToken(address _usr, uint256 _amount) external override whenNotPaused onlyWhitelistedIfNotDecentralized nonReentrant {
        require(_amount != 0, "StableSwapModule/amount-zero");

        uint256 fee = (_amount * feeOut) / WAD;
        uint256 _amountScaled = _convertDecimals(_amount, 18, IToken(token).decimals());
        uint256 tokenAmount = _convertDecimals(_amount - fee, 18, IToken(token).decimals());

        require(tokenBalance[token] >= tokenAmount, "swapStablecoinToToken/not-enough-token-balance");

        if (isDecentralizedState) {
            _checkSingleSwapLimit(_amount);
            _updateAndCheckDailyLimit(_amount);
            _updateAndCheckNumberOfSwapsInBlocksPerLimit();
        }

        tokenBalance[token] -= _amountScaled;
        tokenBalance[stablecoin] += _amount;
        
        totalValueDeposited -= fee;
        
        totalTokenFeeBalance += _convertDecimals(fee, 18, IToken(token).decimals());
        remainingTokenFeeBalance += _convertDecimals(fee, 18, IToken(token).decimals());

        stablecoin.safeTransferFrom(msg.sender, address(this), _amount);
        token.safeTransfer(_usr, tokenAmount);
        emit LogSwapStablecoinToToken(_usr, _amount, fee);
    }

    /** 
     * @dev the function is to be called by the stableswap wrapper to deposit tokens
     * @param _token the address of the token to be deposited
     * @param _amount the amount of tokens to be deposited
     */
    function depositToken(address _token, uint256 _amount) external override nonReentrant whenNotPaused onlyStableswapWrapper {
        require(_token == token || _token == stablecoin, "depositStablecoin/invalid-token");
        require(_amount != 0, "stableswap-depositStablecoin/amount-zero");
        require(_token.balanceOf(msg.sender) >= _amount, "depositStablecoin/not-enough-balance");
        
        tokenBalance[_token] += _amount;
        _token.safeTransferFrom(msg.sender, address(this), _amount);
        
        totalValueDeposited += _convertDecimals(_amount, IToken(_token).decimals(), 18);
    
        if (isDecentralizedState) {
            lastUpdate = block.timestamp;
            remainingDailySwapAmount = _dailySwapLimit();
        }

        emit LogDepositToken(msg.sender, _token, _amount);
    }
    
    /**
     * @dev the function is to be called by the stableswap wrapper to withdraw fees
     * @param _destination the address of the user that receives the fees
     * @param _amountFXDFee the amount of fees in stablecoin to be withdrawn
     * @param _amountTokenFee the amount of fees in tokens to be withdrawn
     */
    function withdrawFees(address _destination, uint256 _amountFXDFee, uint256 _amountTokenFee) external override nonReentrant onlyStableswapWrapper {
        require(_amountFXDFee != 0 || _amountTokenFee != 0, "withdrawFees/amount-zero");
        require(remainingFXDFeeBalance >= _amountFXDFee, "withdrawFees/not-enough-fxd-fee-balance");
        require(remainingTokenFeeBalance >= _amountTokenFee, "withdrawFees/not-enough-token-fee-balance");

        remainingFXDFeeBalance -= _amountFXDFee;
        remainingTokenFeeBalance -= _amountTokenFee;
        
        if(_amountFXDFee > 0) {
            stablecoin.safeTransfer(_destination, _amountFXDFee);
        }
        if(_amountTokenFee > 0) {
            token.safeTransfer(_destination, _amountTokenFee);
        }
    }

    /**
     * @dev the function is to be called by the stableswap wrapper to withdraw tokens
     * @param _token the address of the token to be withdrawn
     * @param _amount the amount of tokens to be withdrawn
     */
    function withdrawToken(address _token, uint256 _amount) external override nonReentrant onlyStableswapWrapper {
        require(_token == token || _token == stablecoin, "withdrawToken/invalid-token");
        require(_amount != 0, "withdrawToken/amount-zero");
        require(tokenBalance[_token] >= _amount, "withdrawToken/not-enough-balance");

        tokenBalance[_token] -= _amount;
        _token.safeTransfer(msg.sender, _amount);

        uint256 amountScaled = _convertDecimals(_amount, IToken(_token).decimals(), 18);

        //to account for precision loss due to convert decimals
        if(amountScaled > totalValueDeposited) {
            totalValueDeposited = 0;
        } else {
            totalValueDeposited -= amountScaled;
        }
        
        emit LogWithdrawToken(msg.sender, _token, _amount);
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external onlyOwnerOrGov {
        _pause();
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external onlyOwnerOrGov {
        _unpause();
    }

    /**
     * @dev the function withdraws whole balance of both the tokens
     * @dev Fees is also withdrawn, so once emergencyWithdraw is done, people wont be able to withdraw their fees
     * @dev All the balances will be reset
    */
    function emergencyWithdraw(address _account) external override nonReentrant onlyOwnerOrGov whenPaused {
        require(_account != address(0), "withdrawFees/empty-account");
        
        totalValueDeposited = 0;
        totalTokenFeeBalance = 0;
        totalFXDFeeBalance = 0;

        remainingFXDFeeBalance = 0;
        remainingTokenFeeBalance = 0;
        
        tokenBalance[token] = 0;
        tokenBalance[stablecoin] = 0;
        
        token.safeTransfer(_account, token.balanceOf(address(this)));
        stablecoin.safeTransfer(_account, stablecoin.balanceOf(address(this)));
        emit LogEmergencyWithdraw(_account);
    }

    function isUserWhitelisted(address _user) external view returns (bool) {
        return usersWhitelist[_user];
    }

    function totalValueLocked() external view returns (uint256) {
        return tokenBalance[stablecoin] + _convertDecimals(tokenBalance[token], IToken(token).decimals(), 18);
    }

    function _updateAndCheckDailyLimit(uint256 _amount) internal {
        if (block.timestamp - lastUpdate >= ONE_DAY) {
            lastUpdate = block.timestamp;
            remainingDailySwapAmount = _dailySwapLimit();
        }
        require(remainingDailySwapAmount >= _amount, "_updateAndCheckDailyLimit/daily-limit-exceeded");
        remainingDailySwapAmount -= _amount;
        emit LogRemainingDailySwapAmount(remainingDailySwapAmount);
    }

    function _updateAndCheckNumberOfSwapsInBlocksPerLimit() internal {
        if (block.number - lastSwapBlockNumberPerUser[msg.sender] >= blocksPerLimit) {
            lastSwapBlockNumberPerUser[msg.sender] = block.number;
            numberOfSwapsRemainingPerUserInBlockLimit[msg.sender] = numberOfSwapsLimitPerUser;
        }
        require(numberOfSwapsRemainingPerUserInBlockLimit[msg.sender] > 0, "_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded");
        numberOfSwapsRemainingPerUserInBlockLimit[msg.sender] = numberOfSwapsRemainingPerUserInBlockLimit[msg.sender] - 1;
    }

    function _checkSingleSwapLimit(uint256 _amount) internal view {
        require(
            _amount <= (totalValueDeposited * singleSwapLimitNumerator) / SINGLE_SWAP_LIMIT_DENOMINATOR,
            "_checkSingleSwapLimit/single-swap-exceeds-limit"
        );
    }

    function _dailySwapLimit() internal view returns (uint256) {
        uint256 newDailySwapLimit = (totalValueDeposited * dailySwapLimitNumerator) / DAILY_SWAP_LIMIT_DENOMINATOR;
        return newDailySwapLimit;
    }

    function _convertDecimals(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10 ** (_toDecimals - _fromDecimals)) : _amount / (10 ** (_fromDecimals - _toDecimals));
    }
}
