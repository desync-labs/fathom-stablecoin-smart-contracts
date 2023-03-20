// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../../interfaces/IBookKeeper.sol";
import "../../../interfaces/IAnkrColAdapter.sol";
import "../../../interfaces/ICagable.sol";
import "../../../interfaces/IManager.sol";
import "../../../interfaces/IProxyRegistry.sol";
import "../../../utils/SafeToken.sol";
import "../../../apis/ankr/interfaces/IAnkrStakingPool.sol";
import "../../../apis/ankr/interfaces/ICertToken.sol";
import "../../../interfaces/IVault.sol";


/// @dev receives WXDC from users and deposit in Vault.
contract CollateralTokenAdapter is IAnkrColAdapter, PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable {
    using SafeToken for address;

    uint256 internal constant WAD = 10**18;
    uint256 internal constant RAY = 10**27;
    uint256 public live;
    bool flagVault;

    address public collateralToken;
    IBookKeeper public bookKeeper;
    bytes32 public override collateralPoolId;

    IVault public vault;
    IManager public positionManager;
    IProxyRegistry public proxyWalletFactory;

    /// @dev Total CollateralTokens that has been staked in WAD
    uint256 public totalShare;

    /// @dev Mapping of user(positionAddress) => collteralTokens that he is staking
    mapping(address => uint256) public stake;

    mapping(address => bool) public whiteListed;

    event LogDeposit(uint256 _val);
    event LogWithdraw(uint256 _val);
    event LogEmergencyWithdraw(address indexed _caller, address _to);
    event LogMoveStake(address indexed _src, address indexed _dst, uint256 _wad);

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

    /// @dev Ignore collateralTokens that have been directly transferred
    function netAssetValuation() public view returns (uint256) {
        return totalShare;
    }

    /// @dev Return Net Assets per Share in wad
    function netAssetPerShare() public view returns (uint256) {
        if (totalShare == 0) return WAD;
        else return wdiv(netAssetValuation(), totalShare);
    }

    function setVault(address _vault) external onlyOwner{
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
    ) external payable override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _deposit(_positionAddress, _amount, _data);
    }

    /// @dev Lock XDC in the vault
    /// deposit collateral tokens to staking contract, and update BookKeeper
    /// @param _positionAddress The position address to be updated
    /// @param _amount The amount to be deposited
    function _deposit(
        address _positionAddress,
        uint256 _amount,
        bytes calldata /* _data */
    ) private {
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
            stake[_positionAddress] = add(stake[_positionAddress], _share);
            
            // safeApprove to Vault
            address(collateralToken).safeApprove(address(vault), _amount);
            //deposit WXDC to Vault
            vault.deposit(_amount);
        }
        emit LogDeposit(_amount); // wxdc
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

    /// @dev   /// withdraw collateral tokens from staking contract, and update BookKeeper and update BookKeeper
    /// @param _usr The position address to be updated
    /// @param _amount The amount to be deposited
    function _withdraw(address _usr, uint256 _amount) private {
        if (_amount > 0) {
            uint256 _share = wdivup(_amount, netAssetPerShare()); // [wad]
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            require(int256(_share) > 0, "CollateralTokenAdapter/share-overflow");
            require(stake[msg.sender] >= _share, "CollateralTokenAdapter/insufficient staked amount");

            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_share));
            totalShare = sub(totalShare, _share);
            stake[msg.sender] = sub(stake[msg.sender], _share);

            //withdraw WXDC from Vault
            vault.withdraw(_amount);
            //Transfer WXDC to proxyWallet
            address(collateralToken).safeTransfer(_usr, _amount);
        }
        emit LogWithdraw(_amount);
    }

    function moveStake(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _moveStake(_source, _destination, _share, _data);
    }

    /// @dev Move wad amount of staked balance from source to destination. Can only be moved if underlaying assets make sense.
    function _moveStake(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata /* data */
    ) private onlyCollateralManager {
        // 1. Update collateral tokens for source and destination
        require(stake[_source] != 0, "CollateralTokenAdapter/SourceNoStakeValue");
        uint256 _stakedAmount = stake[_source];
        stake[_source] = sub(_stakedAmount, _share);
        stake[_destination] = add(stake[_destination], _share);

        (uint256 _lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _source);
        require(
            stake[_source] >= add(bookKeeper.collateralToken(collateralPoolId, _source), _lockedCollateral),
            "CollateralTokenAdapter/stake[source] < collateralTokens + lockedCollateral"
        );
        (_lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _destination);
        require(
            stake[_destination] <= add(bookKeeper.collateralToken(collateralPoolId, _destination), _lockedCollateral),
            "CollateralTokenAdapter/stake[destination] > collateralTokens + lockedCollateral"
        );
        emit LogMoveStake(_source, _destination, _share);
    }

    function onAdjustPosition(
        address _source,
        address _destination,
        int256 _collateralValue,
        int256, /* debtShare */
        bytes calldata _data
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        uint256 _unsignedCollateralValue = _collateralValue < 0 ? uint256(-_collateralValue) : uint256(_collateralValue);
        _moveStake(_source, _destination, _unsignedCollateralValue, _data);
    }

    function onMoveCollateral(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused onlyProxyWalletOrWhiteListed {
        _deposit(_source, 0, _data);
        _moveStake(_source, _destination, _share, _data);
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

    function uncage() external override onlyOwner {
        require(live == 0, "CollateralTokenAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
