// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IERC3156FlashLender.sol";
import "../interfaces/IERC3156FlashBorrower.sol";
import "../interfaces/IBookKeeperFlashLender.sol";
import "../interfaces/IStablecoin.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IPausable.sol";
import "../utils/SafeToken.sol";
import "../utils/CommonMath.sol";

contract FlashMintModule is CommonMath, PausableUpgradeable, IERC3156FlashLender, IBookKeeperFlashLender, IPausable {
    using SafeToken for address;

    IBookKeeper public bookKeeper;
    IStablecoinAdapter public stablecoinAdapter;
    IStablecoin public stablecoin;
    address public systemDebtEngine; // systemDebtEngine intentionally set immutable to save gas

    uint256 public max; // Maximum borrowable stablecoin  [wad]
    uint256 public feeRate; // Fee                     [wad = 100%]
    uint256 private locked; // Reentrancy guard

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");
    bytes32 public constant CALLBACK_SUCCESS_BOOK_KEEPER_STABLE_COIN = keccak256("BookKeeperFlashBorrower.onBookKeeperFlashLoan");

    event LogSetMax(uint256 _data);
    event LogSetFeeRate(uint256 _data);
    event LogFlashLoan(address indexed _receiver, address indexed _token, uint256 _amount, uint256 _fee);
    event LogBookKeeperFlashLoan(address indexed _receiver, uint256 _amount, uint256 _fee);

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

        bookKeeper.whitelist(_stablecoinAdapter);
        address(stablecoin).safeApprove(_stablecoinAdapter, type(uint256).max);
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
        // Add an upper limit of 10^27 Stablecoin to avoid breaking technical assumptions of Stablecoin << 2^256 - 1
        require((max = _data) <= RAD, "FlashMintModule/ceiling-too-high");
        emit LogSetMax(_data);
    }

    function setFeeRate(uint256 _data) external onlyOwner {
        feeRate = _data;
        emit LogSetFeeRate(_data);
    }

    // --- ERC 3156 Spec ---

    function flashLoan(IERC3156FlashBorrower _receiver, address _token, uint256 _amount, bytes calldata _data) external override lock whenNotPaused returns (bool) {
        require(_token == address(stablecoin), "FlashMintModule/token-unsupported");
        require(_amount <= max, "FlashMintModule/ceiling-exceeded");

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
        stablecoinAdapter.deposit(address(this), _total, abi.encode(0));
        bookKeeper.settleSystemBadDebt(_amt);

        return true;
    }

    function bookKeeperFlashLoan(
        IBookKeeperFlashBorrower _receiver, // address of conformant IBookKeeperFlashBorrower
        uint256 _amount, // amount to flash loan [rad]
        bytes calldata _data // arbitrary data to pass to the receiver
    ) external override lock whenNotPaused returns (bool) {
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
