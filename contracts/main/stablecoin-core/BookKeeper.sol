// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IAccessControlConfig.sol";
import "../interfaces/IPausable.sol";
import "../utils/CommonMath.sol";

/// @notice A contract which acts as a book keeper of the Fathom Stablecoin protocol. It has the ability to move collateral token and stablecoin with in the accounting state variable.
contract BookKeeper is IBookKeeper, ICagable, IPausable, CommonMath, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using Address for address;

    struct Position {
        uint256 lockedCollateral; // Locked collateral inside this position (used for minting)                  [wad]
        uint256 debtShare; // The debt share of this position or the share amount of minted Fathom Stablecoin   [wad]
    }

    mapping(bytes32 => mapping(address => Position)) public override positions; // mapping of all positions by collateral pool id and position address
    mapping(bytes32 => mapping(address => uint256)) public override collateralToken; // the accounting of collateral token which is deposited into the protocol [wad]
    mapping(address => uint256) public override stablecoin; // the accounting of the stablecoin that is deposited or has not been withdrawn from the protocol [rad]
    mapping(address => uint256) public override systemBadDebt; // the bad debt of the system from late liquidation [rad]
    mapping(bytes32 => uint256) public override poolStablecoinIssued; // the accounting of the stablecoin issued per collateralPool [rad];

    /// @dev This is the mapping which stores the consent or allowance to adjust positions by the position addresses.
    /// @dev The position address -> The allowance delegate address -> true (1) means allowed or false (0) means not allowed
    mapping(address => mapping(address => uint256)) public override positionWhitelist;

    uint256 public override totalStablecoinIssued; // Total stable coin issued or total stalbecoin in circulation   [rad]
    uint256 public totalUnbackedStablecoin; // Total unbacked stable coin  [rad]
    uint256 public totalDebtCeiling; // Total debt ceiling  [rad]
    uint256 public live; // Active Flag
    address public override collateralPoolConfig;
    address public override accessControlConfig;

    event LogSetTotalDebtCeiling(address indexed _caller, uint256 _totalDebtCeiling);
    event LogSetAccessControlConfig(address indexed _caller, address _accessControlConfig);
    event LogSetCollateralPoolConfig(address indexed _caller, address _collateralPoolConfig);
    event LogAdjustPosition(
        address indexed _caller,
        bytes32 indexed _collateralPoolId,
        address indexed _positionAddress,
        uint256 _lockedCollateral,
        uint256 _debtShare,
        uint256 _positionDebtValue,
        int256 _addCollateral,
        int256 _addDebtShare
    );
    event LogAddCollateral(address indexed _caller, address indexed _usr, int256 _amount);
    event LogMoveCollateral(address indexed _caller, bytes32 indexed _collateralPoolId, address _src, address indexed _dst, uint256 _amount);
    event LogMoveStablecoin(address indexed _caller, address _src, address indexed _dst, uint256 _amount);

    event StablecoinIssuedAmount(uint256 _totalStablecoinIssued, bytes32 indexed _collateralPoolId, uint256 _poolStablecoinIssued);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    modifier onlyPositionManager() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.POSITION_MANAGER_ROLE(), msg.sender), "!positionManagerRole");
        _;
    }

    modifier onlyCollateralManager() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.COLLATERAL_MANAGER_ROLE(), msg.sender), "!collateralManagerRole");
        _;
    }

    modifier onlyLiquidationEngine() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.LIQUIDATION_ENGINE_ROLE(), msg.sender), "!liquidationEngineRole");
        _;
    }

    modifier onlyMintable() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.MINTABLE_ROLE(), msg.sender), "!mintableRole");
        _;
    }

    modifier onlyAdapter() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.ADAPTER_ROLE(), msg.sender), "!adapterRole");
        _;
    }

    modifier onlyStabilityFeeCollector() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(accessControlConfig);
        require(_accessControlConfig.hasRole(_accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), msg.sender), "!stabilityFeeCollectorRole");
        _;
    }

    // --- Init ---

    function initialize(address _collateralPoolConfig, address _accessControlConfig) external initializer {
        require(_collateralPoolConfig.isContract(), "BookKeeper/collateral-pool-config: NOT_CONTRACT_ADDRESS");
        require(_accessControlConfig.isContract(), "BookKeeper/access-control-config: NOT_CONTRACT_ADDRESS");
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "BookKeeper/msgsender-not-owner"
        ); // Sanity Check Call

        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        collateralPoolConfig = _collateralPoolConfig;
        accessControlConfig = _accessControlConfig;
        live = 1;
    }

    // --- Administration ---

    function setTotalDebtCeiling(uint256 _totalDebtCeiling) external onlyOwner {
        _requireLive();
        totalDebtCeiling = _totalDebtCeiling;
        emit LogSetTotalDebtCeiling(msg.sender, _totalDebtCeiling);
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(_accessControlConfig.isContract(), "BookKeeper/access-control-config: NOT_CONTRACT_ADDRESS");
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "BookKeeper/msgsender-not-owner"
        );

        accessControlConfig = _accessControlConfig;
        emit LogSetAccessControlConfig(msg.sender, _accessControlConfig);
    }

    function setCollateralPoolConfig(address _collateralPoolConfig) external onlyOwner {
        require(_collateralPoolConfig.isContract(), "BookKeeper/collateral-pool-config: NOT_CONTRACT_ADDRESS");

        collateralPoolConfig = _collateralPoolConfig;
        emit LogSetCollateralPoolConfig(msg.sender, _collateralPoolConfig);
    }

    // --- Cage ---

    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
    }

    // --- Pause ---

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external override onlyOwnerOrGov {
        _pause();
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }

    // --- Whitelist ---

    /// @dev Give an allowance to the `usr` address to adjust the position address who is the caller.
    function whitelist(address toBeWhitelistedAddress) external override whenNotPaused {
        positionWhitelist[msg.sender][toBeWhitelistedAddress] = 1;
    }

    /// @dev Revoke an allowance from the `usr` address to adjust the position address who is the caller.
    function blacklist(address toBeBlacklistedAddress) external override whenNotPaused {
        positionWhitelist[msg.sender][toBeBlacklistedAddress] = 0;
    }

    // --- Core Logic ---

    function addCollateral(bytes32 _collateralPoolId, address _usr, int256 _amount) external override nonReentrant whenNotPaused onlyAdapter {
        collateralToken[_collateralPoolId][_usr] = add(collateralToken[_collateralPoolId][_usr], _amount);
        emit LogAddCollateral(msg.sender, _usr, _amount);
    }

    function moveCollateral(
        bytes32 _collateralPoolId,
        address _src,
        address _dst,
        uint256 _amount
    ) external override nonReentrant whenNotPaused onlyCollateralManager {
        _requireAllowedPositionAdjustment(_src, msg.sender);
        collateralToken[_collateralPoolId][_src] -= _amount;
        collateralToken[_collateralPoolId][_dst] += _amount;
        emit LogMoveCollateral(msg.sender, _collateralPoolId, _src, _dst, _amount);
    }

    function moveStablecoin(address _src, address _dst, uint256 _value) external override nonReentrant whenNotPaused {
        _requireAllowedPositionAdjustment(_src, msg.sender);
        stablecoin[_src] -= _value;
        stablecoin[_dst] += _value;
        emit LogMoveStablecoin(msg.sender, _src, _dst, _value);
    }

    // solhint-disable function-max-lines
    function adjustPosition(
        bytes32 _collateralPoolId,
        address _positionAddress,
        address _collateralOwner,
        address _stablecoinOwner,
        int256 _collateralValue,
        int256 _debtShare
    ) external override nonReentrant whenNotPaused onlyPositionManager {
        _requireLive();

        ICollateralPoolConfig.CollateralPoolInfo memory _vars = ICollateralPoolConfig(collateralPoolConfig).getCollateralPoolInfo(_collateralPoolId);
        require(_vars.debtAccumulatedRate != 0, "BookKeeper/collateralPool-not-init");

        Position memory position = positions[_collateralPoolId][_positionAddress];
        position.lockedCollateral = add(position.lockedCollateral, _collateralValue);
        position.debtShare = add(position.debtShare, _debtShare);
        _vars.totalDebtShare = add(_vars.totalDebtShare, _debtShare);
        ICollateralPoolConfig(collateralPoolConfig).setTotalDebtShare(_collateralPoolId, _vars.totalDebtShare);

        int256 _debtValue = mul(_vars.debtAccumulatedRate, _debtShare);
        uint256 _positionDebtValue = _vars.debtAccumulatedRate * position.debtShare;
        totalStablecoinIssued = add(totalStablecoinIssued, _debtValue);
        uint256 _poolStablecoinAmount = poolStablecoinIssued[_collateralPoolId];
        poolStablecoinIssued[_collateralPoolId] = add(_poolStablecoinAmount, _debtValue);
        _poolStablecoinAmount = poolStablecoinIssued[_collateralPoolId];
        require(
            either(
                _debtShare <= 0,
                both(_vars.totalDebtShare * _vars.debtAccumulatedRate <= _vars.debtCeiling, totalStablecoinIssued <= totalDebtCeiling)
            ),
            "BookKeeper/ceiling-exceeded"
        );

        require(
            either(both(_debtShare <= 0, _collateralValue >= 0), _positionDebtValue <= position.lockedCollateral * _vars.priceWithSafetyMargin),
            "BookKeeper/not-safe"
        );

        require(either(both(_debtShare <= 0, _collateralValue >= 0), _wish(_positionAddress, msg.sender)), "BookKeeper/not-allowed-position-address");
        require(either(_collateralValue <= 0, _wish(_collateralOwner, msg.sender)), "BookKeeper/not-allowed-collateral-owner");
        require(either(_debtShare >= 0, _wish(_stablecoinOwner, msg.sender)), "BookKeeper/not-allowed-stablecoin-owner");

        require(either(position.debtShare == 0, _positionDebtValue >= _vars.debtFloor), "BookKeeper/debt-floor");
        require(_positionDebtValue <= _vars.positionDebtCeiling, "BookKeeper/position-debt-ceiling-exceeded");
        collateralToken[_collateralPoolId][_collateralOwner] = sub(collateralToken[_collateralPoolId][_collateralOwner], _collateralValue);
        stablecoin[_stablecoinOwner] = add(stablecoin[_stablecoinOwner], _debtValue);

        positions[_collateralPoolId][_positionAddress] = position;

        emit LogAdjustPosition(
            msg.sender,
            _collateralPoolId,
            _positionAddress,
            position.lockedCollateral,
            position.debtShare,
            _positionDebtValue,
            _collateralValue,
            _debtShare
        );
        emit StablecoinIssuedAmount(
            totalStablecoinIssued,
            _collateralPoolId,
            _poolStablecoinAmount // [rad]
        );
    }

    // solhint-enable function-max-lines

    function movePosition(
        bytes32 _collateralPoolId,
        address _src,
        address _dst,
        int256 _collateralAmount,
        int256 _debtShare
    ) external override nonReentrant whenNotPaused onlyPositionManager {
        Position storage _positionSrc = positions[_collateralPoolId][_src];
        Position storage _positionDst = positions[_collateralPoolId][_dst];

        ICollateralPoolConfig.CollateralPoolInfo memory _vars = ICollateralPoolConfig(collateralPoolConfig).getCollateralPoolInfo(_collateralPoolId);

        _positionSrc.lockedCollateral = sub(_positionSrc.lockedCollateral, _collateralAmount);
        _positionSrc.debtShare = sub(_positionSrc.debtShare, _debtShare);
        _positionDst.lockedCollateral = add(_positionDst.lockedCollateral, _collateralAmount);
        _positionDst.debtShare = add(_positionDst.debtShare, _debtShare);

        uint256 _utab = _positionSrc.debtShare * _vars.debtAccumulatedRate;
        uint256 _vtab = _positionDst.debtShare * _vars.debtAccumulatedRate;

        require(both(_wish(_src, msg.sender), _wish(_dst, msg.sender)), "BookKeeper/movePosition/not-allowed");

        require(_utab <= _positionSrc.lockedCollateral * _vars.priceWithSafetyMargin, "BookKeeper/not-safe-src");
        require(_vtab <= _positionDst.lockedCollateral * _vars.priceWithSafetyMargin, "BookKeeper/not-safe-dst");

        require(either(_utab >= _vars.debtFloor, _positionSrc.debtShare == 0), "BookKeeper/debt-floor-src");
        require(either(_vtab >= _vars.debtFloor, _positionDst.debtShare == 0), "BookKeeper/debt-floor-dst");

        require(_vtab <= _vars.positionDebtCeiling, "BookKeeper/position-debt-ceiling-exceeded-dst");
    }

    /** @dev Confiscate position from the owner for the position to be liquidated.
      The position will be confiscated of collateral in which these collateral will be sold through a liquidation process to repay the stablecoin debt.
      The confiscated collateral will be seized by the Auctioneer contracts and will be moved to the corresponding liquidator addresses upon later.
      The stablecoin debt will be mark up on the SystemDebtEngine contract first. This would signify that the system currently has a bad debt of this amount. 
      But it will be cleared later on from a successful liquidation. If this debt is not fully liquidated, the remaining debt will stay inside SystemDebtEngine as bad debt.
    */
    function confiscatePosition(
        bytes32 _collateralPoolId,
        address _positionAddress,
        address _collateralCreditor,
        address _stablecoinDebtor,
        int256 _collateralAmount,
        int256 _debtShare
    ) external override nonReentrant whenNotPaused onlyLiquidationEngine {
        Position storage position = positions[_collateralPoolId][_positionAddress];
        ICollateralPoolConfig.CollateralPoolInfo memory _vars = ICollateralPoolConfig(collateralPoolConfig).getCollateralPoolInfo(_collateralPoolId);
        // -- col from postion
        position.lockedCollateral = add(position.lockedCollateral, _collateralAmount);
        // -- debt from position
        position.debtShare = add(position.debtShare, _debtShare);
        _vars.totalDebtShare = add(_vars.totalDebtShare, _debtShare);
        ICollateralPoolConfig(collateralPoolConfig).setTotalDebtShare(_collateralPoolId, _vars.totalDebtShare);

        int256 _debtValue = mul(_vars.debtAccumulatedRate, _debtShare);

        uint256 _poolStablecoinAmount = poolStablecoinIssued[_collateralPoolId];
        poolStablecoinIssued[_collateralPoolId] = add(_poolStablecoinAmount, _debtValue);
        // ++ col to _collateralCreditor(showStopper in case of skim/accumulateBadDebt)
        collateralToken[_collateralPoolId][_collateralCreditor] = sub(collateralToken[_collateralPoolId][_collateralCreditor], _collateralAmount);
        // ++ debt to systemDebyEngine
        systemBadDebt[_stablecoinDebtor] = sub(systemBadDebt[_stablecoinDebtor], _debtValue);
        totalUnbackedStablecoin = sub(totalUnbackedStablecoin, _debtValue);
    }

    /** @dev Settle the system bad debt of the caller.
      This function will always be called by the SystemDebtEngine which will be the contract that always incur the system debt.
      By executing this function, the SystemDebtEngine must have enough stablecoin which will come from the Surplus of the protocol.
      A successful `settleSystemBadDebt` would remove the bad debt from the system.
    */
    function settleSystemBadDebt(uint256 _value) external override nonReentrant whenNotPaused {
        systemBadDebt[msg.sender] -= _value;
        stablecoin[msg.sender] -= _value;
        totalUnbackedStablecoin -= _value;
        totalStablecoinIssued -= _value;
    }

    function mintUnbackedStablecoin(address _from, address _to, uint256 _value) external override nonReentrant whenNotPaused onlyMintable {
        _requireLive();

        systemBadDebt[_from] += _value;
        stablecoin[_to] += _value;
        totalUnbackedStablecoin += _value;
        totalStablecoinIssued += _value;
    }

    /** @dev Accrue stability fee or the mint interest rate.
      This function will always be called only by the StabilityFeeCollector contract.
      `debtAccumulatedRate` of a collateral pool is the exchange rate of the stablecoin minted from that pool (think of it like collateral price from Lending Vault).
      The higher the `debtAccumulatedRate` means the minter of the stablecoin will need to pay back the debt with higher amount.
      The point of Stability Fee is to collect a surplus amount from minters and this is technically done by incrementing the `debtAccumulatedRate` overtime.
    */
    function accrueStabilityFee(
        bytes32 _collateralPoolId,
        address _stabilityFeeRecipient,
        int256 _debtAccumulatedRate
    ) external override nonReentrant whenNotPaused onlyStabilityFeeCollector {
        _requireLive();

        ICollateralPoolConfig.CollateralPoolInfo memory _vars = ICollateralPoolConfig(collateralPoolConfig).getCollateralPoolInfo(_collateralPoolId);

        _vars.debtAccumulatedRate = add(_vars.debtAccumulatedRate, _debtAccumulatedRate);
        ICollateralPoolConfig(collateralPoolConfig).setDebtAccumulatedRate(_collateralPoolId, _vars.debtAccumulatedRate);
        int256 _value = mul(_vars.totalDebtShare, _debtAccumulatedRate); // [rad]

        uint256 _poolStablecoinAmount = poolStablecoinIssued[_collateralPoolId];
        poolStablecoinIssued[_collateralPoolId] = add(_poolStablecoinAmount, _value);

        stablecoin[_stabilityFeeRecipient] = add(stablecoin[_stabilityFeeRecipient], _value);
        totalStablecoinIssued = add(totalStablecoinIssued, _value);
    }

    function _requireLive() internal view {
        require(live == 1, "BookKeeper/not-live");
    }

    function _requireAllowedPositionAdjustment(address _positionAddress, address _usr) internal view {
        require(_wish(_positionAddress, _usr), "BookKeeper/not-allowed-position-adjustment");
    }

    /// @dev Check if the `usr` address is allowed to adjust the position address (`bit`).
    /// @param bit The position address
    /// @param usr The address to be checked for permission
    function _wish(address bit, address usr) internal view returns (bool) {
        return either(bit == usr, positionWhitelist[bit][usr] == 1);
    }
}
