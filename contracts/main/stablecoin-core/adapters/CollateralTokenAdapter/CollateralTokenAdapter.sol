// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../../interfaces/IBookKeeper.sol";
import "../../../interfaces/ICollateralAdapter.sol";
import "../../../interfaces/ICagable.sol";
import "../../../interfaces/IManager.sol";
import "../../../interfaces/IProxyRegistry.sol";
import "../../../interfaces/IVault.sol";
import "../../../utils/SafeToken.sol";
import "../../../utils/CommonMath.sol";

/// @title CollateralTokenAdapter
/// @dev receives collateral from users and deposit in Vault.
contract CollateralTokenAdapter is CommonMath, ICollateralAdapter, PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable {
    using SafeToken for address;

    uint256 public live;
    bool internal flagVault;

    address public collateralToken;
    IBookKeeper public bookKeeper;
    bytes32 public override collateralPoolId;

    IVault public vault;
    
    /// @dev deprecated but needs to be kept to minimize storage layout confusion
    bytes32 internal deprecated2;
    IProxyRegistry public proxyWalletFactory;

    /// @dev Total CollateralTokens that has been staked in WAD
    uint256 public totalShare;

    /// @dev deprecated but needs to be kept to minimize storage layout confusion
    bytes32 internal deprecated;

    mapping(address => bool) public whiteListed;

    event LogDeposit(uint256 _val);
    event LogWithdraw(uint256 _val);
    event LogWhitelisted(address indexed user, bool isWhitelisted);
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
        address _proxyWalletFactory
    ) external initializer {
        // 1. Initialized all dependencies
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        require(_bookKeeper != address(0), "CollateralTokenAdapter/zero-book-keeper");
        require(_collateralPoolId != bytes32(0), "CollateralTokenAdapter/zero-collateral-pool-id");
        require(_collateralToken != address(0), "CollateralTokenAdapter/zero-collateral-token");
        require(_proxyWalletFactory != address(0), "CollateralTokenAdapter/zero-proxy-wallet-factory");

        live = 1;

        collateralPoolId = _collateralPoolId;
        collateralToken = _collateralToken;
        bookKeeper = IBookKeeper(_bookKeeper);
        proxyWalletFactory = IProxyRegistry(_proxyWalletFactory);
    }
    /// @notice Adds an address to the whitelist, allowing it to interact with the contract
    /// @dev Only the contract owner or a governance address can execute this function. The provided address cannot be the zero address.
    /// @param toBeWhitelisted The address to be added to the whitelist
    function whitelist(address toBeWhitelisted) external onlyOwnerOrGov {
        require(toBeWhitelisted != address(0), "CollateralTokenAdapter/whitelist-invalidAdds");
        whiteListed[toBeWhitelisted] = true;
        emit LogWhitelisted(toBeWhitelisted, true);
    }
    /// @notice Removes an address from the whitelist
    /// @dev Only the contract owner or a governance address can execute this function.
    /// @param toBeRemoved The address to be removed from the whitelist
    function blacklist(address toBeRemoved) external onlyOwnerOrGov {
        whiteListed[toBeRemoved] = false;
        emit LogWhitelisted(toBeRemoved, false);
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
        require(_vault != address(0), "CollateralTokenAdapter/zero-vault");

        flagVault = true;
        vault = IVault(_vault);
    }

    /// @param _positionAddress The address that holding states of the position
    /// @param _amount The collateral token amount that being used as a collateral and to be staked to AnkrStakingPool
    /// @param _data The extra data that may needs to execute the deposit
    function deposit(
        address _positionAddress,
        uint256 _amount,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _deposit(_positionAddress, _amount, _data);
    }

    /// @dev Withdraw collateralToken from Vault
    /// @param _usr The address that holding states of the position
    /// @param _amount The collateralToken amount in Vault to be returned to proxyWallet and then to user
    function withdraw(
        address _usr,
        uint256 _amount,
        bytes calldata /* _data */
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _withdraw(_usr, _amount);
    }

    /// @notice Withdraws the collateral from the Vault as the last step for emergency shutdown
    /// @dev for excessCollateral withdraw flow of emergency shutdown, please call this fn via proxyWallet
    /// @dev for flow that deposits FXD and then withdraw collateral, please call this fn from EOA.
    /// @dev EMERGENCY WHEN COLLATERAL TOKEN ADAPTER CAGED ONLY. Withdraw COLLATERAL from VAULT A after redeemStablecoin
    function emergencyWithdraw(address _to) external nonReentrant {
        if (live == 0) {
            uint256 _amount = bookKeeper.collateralToken(collateralPoolId, msg.sender);
            require(_amount < 2 ** 255, "CollateralTokenAdapter/collateral-overflow");
            //deduct totalShare
            totalShare -= _amount;

            //deduct emergency withdrawl amount of FXD
            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_amount));
            //withdraw collateralToken from Vault
            vault.withdraw(_amount);
            //Transfer collateralToken to msg.sender
            address(collateralToken).safeTransfer(_to, _amount);
            emit LogEmergencyWithdraw(msg.sender, _to);
        }
    }

    /// @dev Lock collateral token in the vault
    /// deposit collateral tokens to staking contract, and update BookKeeper
    /// @param _positionAddress The position address to be updated
    /// @param _amount The amount to be deposited
    function _deposit(address _positionAddress, uint256 _amount, bytes calldata /* _data */) private {
        require(live == 1, "CollateralTokenAdapter/not-live");

        if (_amount > 0) {
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            //transfer collateralToken from proxyWallet to adapter
            address(collateralToken).safeTransferFrom(msg.sender, address(this), _amount);
            //bookKeeping
            bookKeeper.addCollateral(collateralPoolId, _positionAddress, int256(_amount));
            totalShare += _amount;

            // safeApprove to Vault
            address(collateralToken).safeApprove(address(vault), _amount);
            //deposit collateralToken to Vault
            vault.deposit(_amount);
            emit LogDeposit(_amount); // collateralToken
        }
    }

    /// @dev withdraw collateral tokens from staking contract, and update BookKeeper
    /// @param _usr The position address to be updated
    /// @param _amount The amount to be withdrawn
    function _withdraw(address _usr, uint256 _amount) private {
        if (_amount > 0) {
            require(bookKeeper.collateralToken(collateralPoolId, msg.sender) >= _amount, "CollateralTokenAdapter/insufficient collateral amount");
            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_amount));
            totalShare -= _amount;

            //withdraw collateralToken from Vault
            vault.withdraw(_amount);
            //Transfer collateralToken to proxyWallet
            address(collateralToken).safeTransfer(_usr, _amount);
        }
        emit LogWithdraw(_amount);
    }
}
