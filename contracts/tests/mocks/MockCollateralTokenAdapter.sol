// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../main/interfaces/IBookKeeper.sol";
import "../../main/interfaces/ICollateralAdapter.sol";
import "../../main/interfaces/ICagable.sol";
import "../../main/interfaces/IManager.sol";
import "../../main/interfaces/IProxyRegistry.sol";
import "../../main/utils/SafeToken.sol";
import "../../main/interfaces/IVault.sol";

contract MockCollateralTokenAdapterMath {
    uint256 internal constant WAD = 10 ** 18;
    uint256 internal constant RAY = 10 ** 27;

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x, "ds-math-add-overflow");
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x, "ds-math-sub-underflow");
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x, "ds-math-mul-overflow");
    }

    function div(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y > 0, "ds-math-div-by-zero");
        _z = _x / _y;
    }

    function divup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = add(_x, sub(_y, 1)) / _y;
    }

    function wmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, _y) / WAD;
    }

    function wdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, WAD) / _y;
    }

    function wdivup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(mul(_x, WAD), _y);
    }

    function rmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, _y) / RAY;
    }

    function rmulup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(mul(_x, _y), RAY);
    }

    function rdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, RAY) / _y;
    }
}

/// @dev receives WXDC from users and deposit in Vault.
contract MockCollateralTokenAdapter is MockCollateralTokenAdapterMath, ICollateralAdapter, PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable {
    using SafeToken for address;

    uint256 public live;
    bool internal flagVault;

    address public collateralToken;
    IBookKeeper public bookKeeper;
    bytes32 public override collateralPoolId;

    IVault public vault;
    IManager public positionManager;
    IProxyRegistry public proxyWalletFactory;

    /// @dev Total CollateralTokens that has been staked in WAD
    uint256 public totalShare;

    /// @dev deprecated but needs to be kept to minimize storage layout confusion
    bytes32 deprecated;

    mapping(address => bool) public whiteListed;

    event LogDeposit(uint256 _val);
    event LogWithdraw(uint256 _val);
    event LogEmergencyWithdraw(address indexed _caller, address _to);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "CollateralTokenAdapter/not-authorized");
        _;
    }

    modifier onlyProxyWalletOrWhiteListed() {
        require(IProxyRegistry(proxyWalletFactory).isProxy(msg.sender) || whiteListed[msg.sender], "!ProxyOrWhiteList");
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

    modifier onlyCollateralManager() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.COLLATERAL_MANAGER_ROLE(), msg.sender), "!collateralManager");
        _;
    }

    function initialize(
        address _bookKeeper,
        bytes32 _collateralPoolId,
        address _collateralToken,
        address _positionManager,
        address _proxyWalletFactory
    ) external initializer {
        // 1. Initialized all dependencies
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        collateralToken = _collateralToken;

        live = 1;

        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolId = _collateralPoolId;

        positionManager = IManager(_positionManager);

        proxyWalletFactory = IProxyRegistry(_proxyWalletFactory);
    }

    function whitelist(address toBeWhitelisted) external onlyOwnerOrGov {
        require(toBeWhitelisted != address(0), "AnkrColadapter/whitelist-invalidAdds");
        whiteListed[toBeWhitelisted] = true;
    }

    function blacklist(address toBeRemoved) external onlyOwnerOrGov {
        whiteListed[toBeRemoved] = false;
    }

    function cage() external override nonReentrant onlyOwner {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external onlyOwnerOrGov {
        _pause();
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external onlyOwnerOrGov {
        _unpause();
    }

    function setVault(address _vault) external onlyOwner {
        require(true != flagVault, "CollateralTokenAdapter/Vault-set-already");
        flagVault = true;
        vault = IVault(_vault);
    }

    /// @param _positionAddress The address that holding states of the position
    /// @param _amount The XDC amount that being used as a collateral and to be staked to AnkrStakingPool
    /// @param _data The extra data that may needs to execute the deposit
    function deposit(
        address _positionAddress,
        uint256 _amount,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _deposit(_positionAddress, _amount, _data);
    }

    /// @dev Withdraw WXDC from Vault
    /// @param _usr The address that holding states of the position
    /// @param _amount The WXDC col amount in Vault to be returned to proxyWallet and then to user
    function withdraw(
        address _usr,
        uint256 _amount,
        bytes calldata /* _data */
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _withdraw(_usr, _amount);
    }

    /// @dev EMERGENCY WHEN COLLATERAL TOKEN ADAPTER CAGED ONLY. Withdraw COLLATERAL from VAULT A after redeemStablecoin
    function emergencyWithdraw(address _to) external nonReentrant {
        if (live == 0) {
            uint256 _amount = bookKeeper.collateralToken(collateralPoolId, msg.sender);
            require(_amount < 2 ** 255, "CollateralTokenAdapter/collateral-overflow");
            //deduct totalShare
            uint256 _share = wdiv(_amount, netAssetPerShare()); // [wad]
            totalShare = sub(totalShare, _share);

            //deduct emergency withdrawl amount of FXD
            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_amount));
            //withdraw WXDC from Vault
            vault.withdraw(_amount);
            //Transfer WXDC to msg.sender
            address(collateralToken).safeTransfer(_to, _amount);
            emit LogEmergencyWithdraw(msg.sender, _to);
        }
    }

    /// @dev Ignore collateralTokens that have been directly transferred
    function netAssetValuation() public view returns (uint256) {
        return totalShare;
    }

    /// @dev Return Net Assets per Share in wad
    function netAssetPerShare() public view returns (uint256) {
        if (totalShare == 0) return WAD;
        else return wdiv(netAssetValuation(), totalShare);
    }

    /// @dev Lock XDC in the vault
    /// deposit collateral tokens to staking contract, and update BookKeeper
    /// @param _positionAddress The position address to be updated
    /// @param _amount The amount to be deposited
    function _deposit(address _positionAddress, uint256 _amount, bytes calldata /* _data */) private {
        require(live == 1, "CollateralTokenAdapter/not-live");

        if (_amount > 0) {
            uint256 _share = wdiv(_amount, netAssetPerShare()); // [wad]
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            require(int256(_share) > 0, "CollateralTokenAdapter/share-overflow");
            //transfer WXDC from proxyWallet to adapter
            address(collateralToken).safeTransferFrom(msg.sender, address(this), _amount);
            //bookKeeping
            bookKeeper.addCollateral(collateralPoolId, _positionAddress, int256(_share));
            totalShare = add(totalShare, _share);

            // safeApprove to Vault
            address(collateralToken).safeApprove(address(vault), _amount);
            //deposit WXDC to Vault
            vault.deposit(_amount);
        }
        emit LogDeposit(_amount); // wxdc
    }

    /// @dev withdraw collateral tokens from staking contract, and update BookKeeper
    /// @param _usr The position address to be updated
    /// @param _amount The amount to be withdrawn
    function _withdraw(address _usr, uint256 _amount) private {
        if (_amount > 0) {
            uint256 _share = wdivup(_amount, netAssetPerShare()); // [wad]
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            require(int256(_share) > 0, "CollateralTokenAdapter/share-overflow");
            require(bookKeeper.collateralToken(collateralPoolId, msg.sender) >= _share, "CollateralTokenAdapter/insufficient collateral amount");

            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_share));
            totalShare = sub(totalShare, _share);

            //withdraw WXDC from Vault
            vault.withdraw(_amount);
            //Transfer WXDC to proxyWallet
            address(collateralToken).safeTransfer(_usr, _amount);
        }
        emit LogWithdraw(_amount);
    }
}
