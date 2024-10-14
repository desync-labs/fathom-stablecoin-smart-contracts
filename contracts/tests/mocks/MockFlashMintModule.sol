// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import { IERC3156FlashLender } from "../../main/interfaces/IERC3156FlashLender.sol";
import { IERC3156FlashBorrower } from "../../main/interfaces/IERC3156FlashBorrower.sol";
import { IBookKeeperFlashLender } from "../../main/interfaces/IBookKeeperFlashLender.sol";
import { IStablecoin } from "../../main/interfaces/IStablecoin.sol";
import { IStablecoinAdapter } from "../../main/interfaces/IStablecoinAdapter.sol";
import { IBookKeeper } from "../../main/interfaces/IBookKeeper.sol";
import { IPausable } from "../../main/interfaces/IPausable.sol";
import { SafeToken } from "../../main/utils/SafeToken.sol";
import { CommonMath } from "../../main/utils/CommonMath.sol";
import { IAccessControlConfig } from "../../main/interfaces/IAccessControlConfig.sol";
import { IBookKeeperFlashBorrower } from "../../main/interfaces/IBookKeeperFlashBorrower.sol";

contract MockFlashMintModule is CommonMath, PausableUpgradeable, IERC3156FlashLender, IBookKeeperFlashLender, IPausable {
    using SafeToken for address;

    IBookKeeper public bookKeeper;
    IStablecoinAdapter public stablecoinAdapter;
    IStablecoin public stablecoin;
    address public systemDebtEngine;

    uint256 public max; // Maximum borrowable stablecoin  [wad]
    uint256 public feeRate; // Fee                     [wad = 100%]
    uint256 private locked; // Reentrancy guard

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");
    bytes32 public constant CALLBACK_SUCCESS_BOOK_KEEPER_STABLE_COIN = keccak256("BookKeeperFlashBorrower.onBookKeeperFlashLoan");

    mapping(address => bool) public flashMintWhitelist;
    bool public isDecentralizedState;

    event LogSetMax(uint256 _data);
    event LogSetFeeRate(uint256 _data);
    event LogFlashLoan(address indexed _receiver, address indexed _token, uint256 _amount, uint256 _fee);
    event LogBookKeeperFlashLoan(address indexed _receiver, uint256 _amount, uint256 _fee);
    event LogDecentralizedStateStatus(bool _oldDecentralizedStateStatus, bool _newDecentralizedStateStatus);
    event LogAddToWhitelist(address indexed _user);
    event LogRemoveFromWhitelist(address indexed _user);

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
            require(flashMintWhitelist[msg.sender] == true, "FlashMintModule/flashMinter-not-whitelisted");
        }
        _;
    }

    modifier lock() {
        require(locked == 0, "FlashMintModule/reentrancy-guard");
        locked = 1;
        _;
        locked = 0;
    }

    function initialize(address _stablecoinAdapter, address _systemDebtEngine) external initializer {
        // 1. Initialized all dependencies
        PausableUpgradeable.__Pausable_init();

        bookKeeper = IBookKeeper(IStablecoinAdapter(_stablecoinAdapter).bookKeeper());
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        stablecoin = IStablecoin(IStablecoinAdapter(_stablecoinAdapter).stablecoin());
        require(_systemDebtEngine != address(0), "FlashMintModule/bad-system-debt-engine-address");
        systemDebtEngine = _systemDebtEngine;

        bookKeeper.addToWhitelist(_stablecoinAdapter);
        address(stablecoin).safeApprove(_stablecoinAdapter, type(uint256).max);
    }

    /// @notice Add an address to the whitelist
    /// @param _toBeWhitelisted The address to be whitelisted
    /// @dev Can only be called by the contract owner or the governance system
    function addToWhitelist(address _toBeWhitelisted) external onlyOwnerOrGov {
        require(_toBeWhitelisted != address(0), "FlashMintModule/whitelist-invalidAddress");
        require(flashMintWhitelist[_toBeWhitelisted] == false, "FlashMintModule/user-already-whitelisted");
        flashMintWhitelist[_toBeWhitelisted] = true;
        emit LogAddToWhitelist(_toBeWhitelisted);
    }

    /// @notice remove an address from the whitelist
    /// @param _usr The address to be removed from the whitelist
    /// @dev Can only be called by the contract owner or the governance system
    function removeFromWhitelist(address _usr) external onlyOwnerOrGov {
        require(_usr != address(0), "FlashMintModule/removeWL-invalidAddress");
        require(flashMintWhitelist[_usr] == true, "FlashMintModule/user-not-whitelisted");
        flashMintWhitelist[_usr] = false;
        emit LogRemoveFromWhitelist(_usr);
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external override onlyOwnerOrGov {
        _pause();
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }

    function setMax(uint256 _data) external onlyOwner {
        // Add an upper limit of 10^45 Stablecoin to avoid breaking technical assumptions of Stablecoin << 2^256 - 1
        require((max = _data) <= RAD, "FlashMintModule/ceiling-too-high");
        emit LogSetMax(_data);
    }

    function setFeeRate(uint256 _data) external onlyOwner {
        require(_data <= WAD, "FlashMintModule/fee-too-high");
        feeRate = _data;
        emit LogSetFeeRate(_data);
    }

    // To show old state from storage and the new state from call data, emits before changing state
    function setDecentralizedStatesStatus(bool _status) external onlyOwner {
        emit LogDecentralizedStateStatus(isDecentralizedState, _status);
        isDecentralizedState = _status;
    }

    // --- ERC 3156 Spec ---

    function flashLoan(
        IERC3156FlashBorrower _receiver,
        address _token,
        uint256 _amount,
        bytes calldata _data
    ) external override lock whenNotPaused onlyWhitelistedIfNotDecentralized returns (bool) {
        require(_token == address(stablecoin), "FlashMintModule/token-unsupported");
        require(_amount <= max, "FlashMintModule/ceiling-exceeded");

        uint256 _prev = bookKeeper.stablecoin(address(this));
        uint256 _amt = _amount * RAY;
        uint256 _fee = (_amount * feeRate) / WAD;
        uint256 _total = _amount + _fee;

        //_amt is in RAD, to calculate internal balance of stablecoin
        bookKeeper.mintUnbackedStablecoin(address(this), address(this), _amt);
        //minting requested amount to flashMint receiver
        stablecoinAdapter.withdraw(address(_receiver), _amount, abi.encode(0));

        emit LogFlashLoan(address(_receiver), _token, _amount, _fee);

        require(_receiver.onFlashLoan(msg.sender, _token, _amount, _fee, _data) == CALLBACK_SUCCESS, "FlashMintModule/callback-failed");
        address(stablecoin).safeTransferFrom(address(_receiver), address(this), _total); // The fee is also enforced here
        address(stablecoin).safeApprove(address(stablecoinAdapter), _total);
        stablecoinAdapter.deposit(address(this), _total, abi.encode(0));
        address(stablecoin).safeApprove(address(stablecoinAdapter), 0);
        bookKeeper.settleSystemBadDebt(_amt);

        require(bookKeeper.stablecoin(address(this)) >= _prev + _fee, "FlashMintModule/insufficient-fee");

        return true;
    }

    function bookKeeperFlashLoan(
        IBookKeeperFlashBorrower _receiver, // address of conformant IBookKeeperFlashBorrower
        uint256 _amount, // amount to flash loan [rad]
        bytes calldata _data // arbitrary data to pass to the receiver
    ) external override lock whenNotPaused onlyWhitelistedIfNotDecentralized returns (bool) {
        require(_amount <= max * RAY, "FlashMintModule/ceiling-exceeded");

        uint256 _prev = bookKeeper.stablecoin(address(this));
        uint256 _fee = (_amount * feeRate) / WAD;

        bookKeeper.mintUnbackedStablecoin(address(this), address(_receiver), _amount);

        emit LogBookKeeperFlashLoan(address(_receiver), _amount, _fee);

        require(
            _receiver.onBookKeeperFlashLoan(msg.sender, _amount, _fee, _data) == CALLBACK_SUCCESS_BOOK_KEEPER_STABLE_COIN,
            "FlashMintModule/callback-failed"
        );

        bookKeeper.settleSystemBadDebt(_amount);
        require(bookKeeper.stablecoin(address(this)) >= _prev + _fee, "FlashMintModule/insufficient-fee");

        return true;
    }

    function convert() external lock whenNotPaused {
        stablecoinAdapter.deposit(address(this), stablecoin.balanceOf(address(this)), abi.encode(0));
    }

    function accrue() external lock whenNotPaused {
        bookKeeper.moveStablecoin(address(this), systemDebtEngine, bookKeeper.stablecoin(address(this)));
    }

    function refreshApproval() external lock onlyOwner {
        address(stablecoin).safeApprove(address(stablecoinAdapter), type(uint256).max);
    }

    function maxFlashLoan(address _token) external view override returns (uint256) {
        if (_token == address(stablecoin) && locked == 0) {
            return max;
        } else {
            return 0;
        }
    }

    function flashFee(address _token, uint256 _amount) external view override returns (uint256) {
        require(_token == address(stablecoin), "FlashMintModule/token-unsupported");

        return (_amount * feeRate) / WAD;
    }
}
