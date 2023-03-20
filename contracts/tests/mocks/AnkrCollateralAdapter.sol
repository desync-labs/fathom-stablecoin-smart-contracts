// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../../main/interfaces/IBookKeeper.sol";
import "../../main/interfaces/IAnkrColAdapter.sol";
import "../../main/interfaces/ICagable.sol";
import "../../main/interfaces/IManager.sol";
import "../../main/interfaces/IProxyRegistry.sol";
import "../../main/utils/SafeToken.sol";
import "../../main/apis/ankr/interfaces/IAnkrStakingPool.sol";
import "../../main/apis/ankr/interfaces/ICertToken.sol";

/// @dev receives XDC from users and deposit in Ankr's staking. Hence, users will still earn reward from changing aXDCc ratio
contract AnkrCollateralAdapter is IAnkrColAdapter, PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable {
    using SafeToken for address;

    uint256 internal constant WAD = 10**18;
    uint256 internal constant RAY = 10**27;

    struct RatioNCerts {
        uint256 ratio;
        uint256 CertsAmount;
    }

    uint256 public live;

    IBookKeeper public bookKeeper;
    bytes32 public override collateralPoolId;

    IManager public positionManager;

    IAnkrStakingPool public XDCPoolAddress;
    ICertToken public aXDCcAddress;

    IProxyRegistry public proxyWalletFactory;

    /// @dev Total CollateralTokens that has been staked in WAD
    uint256 public totalShare;

    /// @dev Mapping of user(positionAddress) => recordRatioNCerts that he has ownership over.
    mapping(address => RatioNCerts) public recordRatioNCerts;
    /// @dev Mapping of user(positionAddress) => collteralTokens that he is staking
    mapping(address => uint256) public stake;

    mapping(address => bool) public whiteListed;

    event LogDeposit(uint256 _val);
    event LogWithdraw(uint256 _val);
    event LogCertsInflow(uint256 _valCerts);
    event LogCertsOutflow(uint256 _valCerts);
    event LogEmergencyWithdraw(address indexed _caller, address _to);
    event LogMoveStake(address indexed _src, address indexed _dst, uint256 _wad);
    event LogSetTreasuryAccount(address indexed _caller, address _treasuryAccount);
    event LogSetTreasuryFeeBps(address indexed _caller, uint256 _treasuryFeeBps);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "AnkrCollateralAdapter/not-authorized");
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
        address _xdcPoolAddress,
        address _aXDCcAddress,
        address _positionManager,
        address _proxyWalletFactory
    ) external initializer {
        // 1. Initialized all dependencies
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        XDCPoolAddress = IAnkrStakingPool(_xdcPoolAddress);
        aXDCcAddress = ICertToken(_aXDCcAddress);

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

    /// @dev Stake XDC to AnkrStakingPool, receive aXDCc and record
    /// deposit collateral tokens to staking contract, and update BookKeeper
    /// @param _positionAddress The position address to be updated
    /// @param _amount The amount to be deposited
    function _deposit(
        address _positionAddress,
        uint256 _amount,
        bytes calldata /* _data */
    ) private {
        require(live == 1, "AnkrCollateralAdapter/not-live");
        require(_amount == msg.value, "AnkrCollateralAdapter/DepositAmountMismatch");

        if (_amount > 0) {
            uint256 _share = wdiv(_amount, netAssetPerShare()); // [wad]
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            require(int256(_share) > 0, "AnkrCollateralAdapter/share-overflow");

            //bookKeeping
            bookKeeper.addCollateral(collateralPoolId, _positionAddress, int256(_share));
            totalShare = add(totalShare, _share);
            stake[_positionAddress] = add(stake[_positionAddress], _share);

            //record aXDCc amount before stakeCerts
            uint256 aXDCcBefore = aXDCcAddress.balanceOf(address(this));
            XDCPoolAddress.stakeCerts{ value: msg.value }();
            uint256 aXDCcAfter = aXDCcAddress.balanceOf(address(this));

            uint256 certsIn = (aXDCcAfter - aXDCcBefore);
            RatioNCerts memory ratioNCerts = RatioNCerts(aXDCcAddress.ratio(), certsIn);

            // if it is first record of staking
            if (recordRatioNCerts[_positionAddress].ratio == 0 && recordRatioNCerts[_positionAddress].CertsAmount == 0) {
                recordRatioNCerts[_positionAddress] = ratioNCerts;
            } else {
                // if it is not the first record of staking
                // calculate weighted average of ratio from already existing ratio&CertsAmount and incoming ratio&CertsAmount
                uint256 certsBefore = recordRatioNCerts[_positionAddress].CertsAmount;
                uint256 ratioBefore = recordRatioNCerts[_positionAddress].ratio;
                uint256 aXDCcRatio = aXDCcAddress.ratio();
                uint256 calculatedNewRatio = add(
                    wmul(ratioBefore, wdiv(certsBefore, add(certsBefore, certsIn))),
                    wmul(aXDCcRatio, wdiv(certsIn, add(certsBefore, certsIn)))
                );
                if (calculatedNewRatio <= aXDCcRatio) {
                    recordRatioNCerts[_positionAddress].ratio = aXDCcRatio;
                } else {
                    recordRatioNCerts[_positionAddress].ratio = calculatedNewRatio;
                }

                recordRatioNCerts[_positionAddress].CertsAmount = add(recordRatioNCerts[_positionAddress].CertsAmount, certsIn);
                emit LogCertsInflow(certsIn); // aXDCc
            }
        }
        emit LogDeposit(_amount); // xdc
    }

    /// @dev Withdraw aXDCc from AnkrCollateralAdapter
    /// @param _usr The address that holding states of the position
    /// @param _amount The XDC col amount(translated to aXDCc) to be withdrawn from AnkrCollateralAdapter and return to user
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
            require(int256(_share) > 0, "AnkrCollateralAdapter/share-overflow");
            require(stake[msg.sender] >= _share, "AnkrCollateralAdapter/insufficient staked amount");

            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_share));
            totalShare = sub(totalShare, _share);
            stake[msg.sender] = sub(stake[msg.sender], _share);

            uint256 withdrawAmount = recordRatioNCerts[msg.sender].CertsAmount;
            recordRatioNCerts[msg.sender].CertsAmount = 0;
            SafeToken.safeTransfer(address(aXDCcAddress), _usr, withdrawAmount);
            emit LogCertsOutflow(withdrawAmount);
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
        require(stake[_source] != 0, "AnkrCollateralAdapter/SourceNoStakeValue");
        uint256 _stakedAmount = stake[_source];
        stake[_source] = sub(_stakedAmount, _share);
        stake[_destination] = add(stake[_destination], _share);

        (uint256 _lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _source);
        require(
            stake[_source] >= add(bookKeeper.collateralToken(collateralPoolId, _source), _lockedCollateral),
            "AnkrCollateralAdapter/stake[source] < collateralTokens + lockedCollateral"
        );
        (_lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _destination);
        require(
            stake[_destination] <= add(bookKeeper.collateralToken(collateralPoolId, _destination), _lockedCollateral),
            "AnkrCollateralAdapter/stake[destination] > collateralTokens + lockedCollateral"
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
        _moveCerts(_source, _destination, _share, _data);
        _moveStake(_source, _destination, _share, _data);
    }

    function _moveCerts(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata /* _data */
    ) internal onlyCollateralManager {
        require(stake[_source] != 0, "AnkrCollateralAdapter/SourceNoStakeValue");
        uint256 certsToMoveRatio;
        if (_share >= stake[_source]) {
            certsToMoveRatio = WAD;
        } else {
            require(_share < stake[_source], "AnkrCollateralAdapter/tooMuchShare");
            certsToMoveRatio = wdiv(_share, stake[_source]);
        }

        uint256 certsMove = wmul(certsToMoveRatio, recordRatioNCerts[_source].CertsAmount);

        //update CertsAmount in source
        recordRatioNCerts[_source].CertsAmount -= certsMove;

        uint256 certsBefore = recordRatioNCerts[_destination].CertsAmount;
        uint256 ratioBefore = recordRatioNCerts[_destination].ratio;

        uint256 calculatedNewRatio = add(
            wmul(ratioBefore, wdiv(certsBefore, add(certsBefore, certsMove))),
            wmul(recordRatioNCerts[_source].ratio, wdiv(certsMove, add(certsBefore, certsMove)))
        );

        uint256 aXDCcRatio = aXDCcAddress.ratio();

        //update ratio in destination
        if (calculatedNewRatio <= aXDCcRatio) {
            recordRatioNCerts[_destination].ratio = aXDCcRatio;
        } else {
            recordRatioNCerts[_destination].ratio = calculatedNewRatio;
        }

        //update CertsAmount in destination
        recordRatioNCerts[_destination].CertsAmount += certsMove;
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
        require(live == 0, "AnkrCollateralAdapter/not-caged");
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
