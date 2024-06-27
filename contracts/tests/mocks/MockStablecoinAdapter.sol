// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../main/interfaces/IStablecoin.sol";
import "../../main/interfaces/IBookKeeper.sol";
import "../../main/interfaces/IStablecoinAdapter.sol";
import "../../main/interfaces/ICagable.sol";
import "../../main/interfaces/IPausable.sol";
import "../../main/utils/CommonMath.sol";

/**
 * @title Stablecoin Adapter contract
 * @dev Handles deposit and withdrawal of stablecoins, along with emergency shutdown (caging) functionality.
 */

contract MockStablecoinAdapter is CommonMath, PausableUpgradeable, ReentrancyGuardUpgradeable, IStablecoinAdapter, ICagable, IPausable {
    IBookKeeper public override bookKeeper; // CDP Engine
    IStablecoin public override stablecoin; // Stablecoin Token
    uint256 public live; // Active Flag

    event LogCrossChainTransferOut(address indexed _from, uint256 _amount);
    event LogCrossChainTransferIn(address indexed _to, uint256 _amount);

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    modifier onlyLiquidationStrategy(bytes32 _collateralPoolId) {
        ICollateralPoolConfig _collateralPoolConfig = ICollateralPoolConfig(bookKeeper.collateralPoolConfig());
        require(msg.sender == _collateralPoolConfig.getStrategy(_collateralPoolId), "!(LiquidationStrategy)");
        _;
    }

    modifier onlyBridge() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.BRIDGE_ROLE(), msg.sender),
            "!(bridgeRole)"           
        );
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _bookKeeper, address _stablecoin) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        require(_bookKeeper != address(0), "StablecoinAdapter/zero-book-keeper");
        require(_stablecoin != address(0), "StablecoinAdapter/zero-stablecoin");

        live = 1;
        bookKeeper = IBookKeeper(_bookKeeper);
        stablecoin = IStablecoin(_stablecoin);
    }

    /// @dev Cage function halts stablecoinAdapter contract for good.
    /// Please be cautious with this function since there is no uncage function
    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
    }

    /// @notice Deposits stablecoin from msg.sender into the BookKeeper.
    /// @param _usr Address of the user to credit the deposit to.
    /// @param _wad Amount to deposit. [wad]
    function deposit(address _usr, uint256 _wad, bytes calldata /* data */) external override nonReentrant whenNotPaused {
        bookKeeper.moveStablecoin(address(this), _usr, _wad * RAY);
        stablecoin.burn(msg.sender, _wad);
    }

    /// @notice Deposits stablecoin from msg.sender into the BookKeeper in RAD.
    /// @param _usr Address of the user to credit the deposit to.
    /// @param _rad Amount to deposit. [rad]
    function depositRAD(
        address _usr,
        uint256 _rad,
        bytes32 _collateralPoolId,
        bytes calldata /* data */
    ) external override nonReentrant whenNotPaused onlyLiquidationStrategy(_collateralPoolId) {
        bookKeeper.moveStablecoin(address(this), _usr, _rad);
        stablecoin.burn(msg.sender, (_rad / RAY) + 1);
    }

    /// @notice Withdraws stablecoin to a specified user.
    /// @param _usr Address of the user to withdraw stablecoin to.
    /// @param _wad Amount to withdraw. [wad]
    function withdraw(address _usr, uint256 _wad, bytes calldata /* data */) external override nonReentrant whenNotPaused {
        require(live == 1, "StablecoinAdapter/not-live");
        bookKeeper.moveStablecoin(msg.sender, address(this), _wad * RAY);
        stablecoin.mint(_usr, _wad);
    }

    function crossChainTransferOut(address _from, uint256 _amount) external onlyBridge{
        require(live == 1, "StablecoinAdapter/not-live");
        stablecoin.burn(msg.sender, _amount);
        emit LogCrossChainTransferOut(_from, _amount);
    }

    function crossChainTransferIn(address _to, uint256 _amount) external onlyBridge{
        require(live == 1, "StablecoinAdapter/not-live");
        stablecoin.mint(_to, _amount);
        emit LogCrossChainTransferIn(_to, _amount);
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external override onlyOwnerOrGov {
        _pause();
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }
}
