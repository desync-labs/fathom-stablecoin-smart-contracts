// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../../interfaces/IPriceFeed.sol";
import "../../interfaces/IGenericTokenAdapter.sol";
import "../../interfaces/ICollateralPoolConfig.sol";
import "../../interfaces/IAccessControlConfig.sol";

/**
 * @title CollateralPoolConfig
 * @notice A contract can add collateral pool type to the protocol and also manage settings for a specific pool type.
 */

contract CollateralPoolConfig is AccessControlUpgradeable, ICollateralPoolConfig {
    uint256 internal constant RAY = 10 ** 27;

    mapping(bytes32 => ICollateralPoolConfig.CollateralPool) private _collateralPools;
    IAccessControlConfig public accessControlConfig;

    event LogSetPriceWithSafetyMargin(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _priceWithSafetyMargin);
    event LogSetDebtCeiling(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _debtCeiling);
    event LogSetDebtFloor(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _debtFloor);
    event LogSetPriceFeed(address indexed _caller, bytes32 indexed _poolId, address _priceFeed);
    event LogSetLiquidationRatio(address indexed _caller, bytes32 indexed _poolId, uint256 _data);
    event LogSetStabilityFeeRate(address indexed _caller, bytes32 indexed _poolId, uint256 _data);
    event LogSetAdapter(address indexed _caller, bytes32 indexed _collateralPoolId, address _adapter);
    event LogSetCloseFactorBps(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _closeFactorBps);
    event LogSetLiquidatorIncentiveBps(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _liquidatorIncentiveBps);
    event LogSetTreasuryFeesBps(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _treasuryFeeBps);
    event LogSetStrategy(address indexed _caller, bytes32 indexed _collateralPoolId, address strategy);
    event LogSetTotalDebtShare(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _totalDebtShare);
    event LogSetDebtAccumulatedRate(address indexed _caller, bytes32 indexed _collateralPoolId, uint256 _debtAccumulatedRate);
    event LogInitCollateralPoolId(
        bytes32 indexed _collateralPoolId,
        uint256 _debtCeiling,
        uint256 _liquidationRatio,
        uint256 _stabilityFeeRate,
        address _adapter
    );
    event LogPositionDebtCeiling(address _messageSender, bytes32 _collateralPoolId, uint256 _positionDebtCeiling);

    modifier onlyOwner() {
        require(accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    function initialize(address _accessControlConfig) external initializer {
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }
    /**
    //@notice this function adds a collateral pool type to Fathom protocol
    //@dev please refer to the deployment/migration script for more detail info on units for each params.
     */
    function initCollateralPool(
        bytes32 _collateralPoolId, // Identifier for a specific collateral pool.
        uint256 _debtCeiling, // Debt ceiling of this collateral pool                                          [rad] 
        uint256 _debtFloor, // Position debt floor of this collateral pool                                     [rad]
        uint256 _positionDebtCeiling, // position debt ceiling of this collateral pool                         [rad]
        address _priceFeed,
        uint256 _liquidationRatio, // Liquidation ratio or Collateral ratio, inverse of LTV                    [ray]
        uint256 _stabilityFeeRate, //Collateral-specific, per-second stability fee debtAccumulatedRate or mint interest debtAccumulatedRate [ray]
        address _adapter,   // collateralTokenAdapter address for a specific collateral pool
        uint256 _closeFactorBps, // Percentage (BPS) of how much  of debt could be liquidated in a single liquidation
        uint256 _liquidatorIncentiveBps, // Percentage (BPS) of how much additional collateral will be given to the liquidator incentive
        uint256 _treasuryFeesBps, // Percentage (BPS) of how much additional collateral will be transferred to the treasury
        address _strategy  // Liquidation strategy for this collateral pool
    ) external onlyOwner {
        require(_collateralPools[_collateralPoolId].debtAccumulatedRate == 0, "CollateralPoolConfig/collateral-pool-already-init");
        require(_debtCeiling > _debtFloor, "CollateralPoolConfig/invalid-ceiliing");
        require(
            _positionDebtCeiling <= _debtCeiling && _positionDebtCeiling > _debtFloor, 
            "CollateralPoolConfig/invalid-position-ceiling"
        );
        
        _collateralPools[_collateralPoolId].debtAccumulatedRate = RAY;
        _collateralPools[_collateralPoolId].debtCeiling = _debtCeiling;
        _collateralPools[_collateralPoolId].debtFloor = _debtFloor;
        _collateralPools[_collateralPoolId].positionDebtCeiling = _positionDebtCeiling;

        require(IPriceFeed(_priceFeed).poolId() == _collateralPoolId, "CollateralPoolConfig/wrong-price-feed-pool");
        require(IPriceFeed(_priceFeed).isPriceOk(), "CollateralPoolConfig/unhealthy-price-feed");
        IPriceFeed(_priceFeed).peekPrice(); // Sanity Check Call

        _collateralPools[_collateralPoolId].priceFeed = _priceFeed;
        require(_liquidationRatio >= RAY, "CollateralPoolConfig/invalid-liquidation-ratio");
        _collateralPools[_collateralPoolId].liquidationRatio = _liquidationRatio;
        require(_stabilityFeeRate >= RAY, "CollateralPoolConfig/invalid-stability-fee-rate");
        // Maximum stability fee rate is 50% yearly
        require(_stabilityFeeRate <= 1000000012857214317438491659, "CollateralPoolConfig/stability-fee-rate-too-large");
        _collateralPools[_collateralPoolId].stabilityFeeRate = _stabilityFeeRate;
        _collateralPools[_collateralPoolId].lastAccumulationTime = block.timestamp;

        require(_adapter != address(0), "CollateralPoolConfig/zero-adapter");
        require(IGenericTokenAdapter(_adapter).collateralPoolId() == _collateralPoolId, "CollateralPoolConfig/wrong-adapter");
        _collateralPools[_collateralPoolId].adapter = _adapter;
        require(_closeFactorBps > 0 && _closeFactorBps <= 10000, "CollateralPoolConfig/invalid-close-factor-bps");
        require(_liquidatorIncentiveBps >= 10000 && _liquidatorIncentiveBps <= 19000, "CollateralPoolConfig/invalid-liquidator-incentive-bps");
        require(_treasuryFeesBps <= 9000, "CollateralPoolConfig/invalid-treasury-fees-bps");
        _collateralPools[_collateralPoolId].closeFactorBps = _closeFactorBps;
        _collateralPools[_collateralPoolId].liquidatorIncentiveBps = _liquidatorIncentiveBps;
        _collateralPools[_collateralPoolId].treasuryFeesBps = _treasuryFeesBps;
        _collateralPools[_collateralPoolId].strategy = _strategy;

        emit LogInitCollateralPoolId(_collateralPoolId, _debtCeiling, _liquidationRatio, _stabilityFeeRate, _adapter);
    }

    function setPriceWithSafetyMargin(bytes32 _collateralPoolId, uint256 _priceWithSafetyMargin) external override {
        require(accessControlConfig.hasRole(accessControlConfig.PRICE_ORACLE_ROLE(), msg.sender), "!priceOracleRole");
        _collateralPools[_collateralPoolId].priceWithSafetyMargin = _priceWithSafetyMargin;
        emit LogSetPriceWithSafetyMargin(msg.sender, _collateralPoolId, _priceWithSafetyMargin);
    }

    function setDebtCeiling(bytes32 _collateralPoolId, uint256 _debtCeiling) external onlyOwner {
        require(
            _debtCeiling >= _collateralPools[_collateralPoolId].positionDebtCeiling, 
            "CollateralPoolConfig/invalid-debt-ceiling"
        );

        _collateralPools[_collateralPoolId].debtCeiling = _debtCeiling;
        emit LogSetDebtCeiling(msg.sender, _collateralPoolId, _debtCeiling);
    }

    function setDebtFloor(bytes32 _collateralPoolId, uint256 _debtFloor) external onlyOwner {
        require(_debtFloor < _collateralPools[_collateralPoolId].positionDebtCeiling, "CollateralPoolConfig/invalid-debt-floor");
        _collateralPools[_collateralPoolId].debtFloor = _debtFloor;
        emit LogSetDebtFloor(msg.sender, _collateralPoolId, _debtFloor);
    }

    function setPositionDebtCeiling(bytes32 _collateralPoolId, uint256 _positionDebtCeiling) external override onlyOwner {
        require(
            _positionDebtCeiling <= _collateralPools[_collateralPoolId].debtCeiling &&
                _positionDebtCeiling > _collateralPools[_collateralPoolId].debtFloor,
            "CollateralPoolConfig/invalid-position-ceiling"
        );
        _collateralPools[_collateralPoolId].positionDebtCeiling = _positionDebtCeiling;
        emit LogPositionDebtCeiling(msg.sender, _collateralPoolId, _positionDebtCeiling);
    }

    function setPriceFeed(bytes32 _poolId, address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "CollateralPoolConfig/zero-price-feed");
        require(IPriceFeed(_priceFeed).poolId() == _poolId, "CollateralPoolConfig/wrong-price-feed-pool");
        require(IPriceFeed(_priceFeed).isPriceOk(), "CollateralPoolConfig/unhealthy-price-feed");

        IPriceFeed(_priceFeed).peekPrice();

        _collateralPools[_poolId].priceFeed = _priceFeed;
        emit LogSetPriceFeed(msg.sender, _poolId, _priceFeed);
    }

    function setLiquidationRatio(bytes32 _poolId, uint256 _liquidationRatio) external onlyOwner {
        require(_liquidationRatio >= RAY && _liquidationRatio <= RAY * 100, "CollateralPoolConfig/invalid-liquidation-ratio");
        _collateralPools[_poolId].liquidationRatio = _liquidationRatio;
        emit LogSetLiquidationRatio(msg.sender, _poolId, _liquidationRatio);
    }

    /** @dev Set the stability fee rate of the collateral pool.
      The rate to be set here is the `r` in:
          r^N = APR
      Where:
        r = stability fee rate
        N = Accumulation frequency which is per-second in this case; the value will be 60*60*24*365 = 31536000 to signify the number of seconds within a year.
        APR = the annual percentage rate
    For example, to achieve 0.5% APR for stability fee rate:
          r^31536000 = 1.005
    Find the 31536000th root of 1.005 and we will get:
          r = 1.000000000158153903837946258002097...
    The rate is in [ray] format, so the actual value of `stabilityFeeRate` will be:
          stabilityFeeRate = 1000000000158153903837946258
    The above `stabilityFeeRate` will be the value we will use in this contract.
  */
    function setStabilityFeeRate(bytes32 _collateralPool, uint256 _stabilityFeeRate) external onlyOwner {
        require(_stabilityFeeRate >= RAY, "CollateralPoolConfig/invalid-stability-fee-rate");
        // Maximum stability fee rate is 50% yearly
        require(_stabilityFeeRate <= 1000000012857214317438491659, "CollateralPoolConfig/stability-fee-rate-too-large");
        _collateralPools[_collateralPool].stabilityFeeRate = _stabilityFeeRate;
        emit LogSetStabilityFeeRate(msg.sender, _collateralPool, _stabilityFeeRate);
    }

    function setAdapter(bytes32 _collateralPoolId, address _adapter) external onlyOwner {
        require(_adapter != address(0), "CollateralPoolConfig/setAdapter-zero-address");
        require(IGenericTokenAdapter(_adapter).collateralPoolId() == _collateralPoolId, "CollateralPoolConfig/setAdapter-wrongPoolId");
        _collateralPools[_collateralPoolId].adapter = _adapter;
        emit LogSetAdapter(msg.sender, _collateralPoolId, _adapter);
    }

    function setCloseFactorBps(bytes32 _collateralPoolId, uint256 _closeFactorBps) external onlyOwner {
        require(_closeFactorBps > 0 && _closeFactorBps <= 10000, "CollateralPoolConfig/invalid-close-factor-bps");
        _collateralPools[_collateralPoolId].closeFactorBps = _closeFactorBps;
        emit LogSetCloseFactorBps(msg.sender, _collateralPoolId, _closeFactorBps);
    }

    function setLiquidatorIncentiveBps(bytes32 _collateralPoolId, uint256 _liquidatorIncentiveBps) external onlyOwner {
        require(_liquidatorIncentiveBps >= 10000 && _liquidatorIncentiveBps <= 19000, "CollateralPoolConfig/invalid-liquidator-incentive-bps");
        _collateralPools[_collateralPoolId].liquidatorIncentiveBps = _liquidatorIncentiveBps;
        emit LogSetLiquidatorIncentiveBps(msg.sender, _collateralPoolId, _liquidatorIncentiveBps);
    }

    function setTreasuryFeesBps(bytes32 _collateralPoolId, uint256 _treasuryFeesBps) external onlyOwner {
        require(_treasuryFeesBps <= 9000, "CollateralPoolConfig/invalid-treasury-fees-bps");
        _collateralPools[_collateralPoolId].treasuryFeesBps = _treasuryFeesBps;
        emit LogSetTreasuryFeesBps(msg.sender, _collateralPoolId, _treasuryFeesBps);
    }

    function setTotalDebtShare(bytes32 _collateralPoolId, uint256 _totalDebtShare) external override {
        require(accessControlConfig.hasRole(accessControlConfig.BOOK_KEEPER_ROLE(), msg.sender), "!bookKeeperRole");
        _collateralPools[_collateralPoolId].totalDebtShare = _totalDebtShare;
        emit LogSetTotalDebtShare(msg.sender, _collateralPoolId, _totalDebtShare);
    }

    function setDebtAccumulatedRate(bytes32 _collateralPoolId, uint256 _debtAccumulatedRate) external override {
        require(accessControlConfig.hasRole(accessControlConfig.BOOK_KEEPER_ROLE(), msg.sender), "!bookKeeperRole");
        require(_debtAccumulatedRate >= RAY, "CollateralPoolConfig/invalid-debt-accumulated-rate");
        _collateralPools[_collateralPoolId].debtAccumulatedRate = _debtAccumulatedRate;
        emit LogSetDebtAccumulatedRate(msg.sender, _collateralPoolId, _debtAccumulatedRate);
    }

    function setStrategy(bytes32 _collateralPoolId, address _strategy) external onlyOwner {
        require(_strategy != address(0), "CollateralPoolConfig/zero-strategy");

        _collateralPools[_collateralPoolId].strategy = _strategy;
        emit LogSetStrategy(msg.sender, _collateralPoolId, address(_strategy));
    }

    function updateLastAccumulationTime(bytes32 _collateralPoolId) external override {
        require(accessControlConfig.hasRole(accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), msg.sender), "!stabilityFeeCollectorRole");
        _collateralPools[_collateralPoolId].lastAccumulationTime = block.timestamp;
    }

    function collateralPools(bytes32 _collateralPoolId) external view override returns (ICollateralPoolConfig.CollateralPool memory) {
        return _collateralPools[_collateralPoolId];
    }

    function getTotalDebtShare(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].totalDebtShare;
    }

    function getDebtAccumulatedRate(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].debtAccumulatedRate;
    }

    function getPriceWithSafetyMargin(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].priceWithSafetyMargin;
    }

    function getDebtCeiling(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].debtCeiling;
    }

    function getPositionDebtCeiling(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].positionDebtCeiling;
    }

    function getDebtFloor(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].debtFloor;
    }

    function getPriceFeed(bytes32 _collateralPoolId) external view override returns (address) {
        return _collateralPools[_collateralPoolId].priceFeed;
    }

    function getLiquidationRatio(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].liquidationRatio;
    }

    function getStabilityFeeRate(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].stabilityFeeRate;
    }

    function getLastAccumulationTime(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].lastAccumulationTime;
    }

    function getAdapter(bytes32 _collateralPoolId) external view override returns (address) {
        return _collateralPools[_collateralPoolId].adapter;
    }

    function getCloseFactorBps(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].closeFactorBps;
    }

    function getLiquidatorIncentiveBps(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].liquidatorIncentiveBps;
    }

    function getTreasuryFeesBps(bytes32 _collateralPoolId) external view override returns (uint256) {
        return _collateralPools[_collateralPoolId].treasuryFeesBps;
    }

    function getStrategy(bytes32 _collateralPoolId) external view override returns (address) {
        return _collateralPools[_collateralPoolId].strategy;
    }

    function getCollateralPoolInfo(bytes32 _collateralPoolId) external view override returns (CollateralPoolInfo memory _info) {
        _info.debtAccumulatedRate = _collateralPools[_collateralPoolId].debtAccumulatedRate;
        _info.totalDebtShare = _collateralPools[_collateralPoolId].totalDebtShare;
        _info.debtCeiling = _collateralPools[_collateralPoolId].debtCeiling;
        _info.priceWithSafetyMargin = _collateralPools[_collateralPoolId].priceWithSafetyMargin;
        _info.debtFloor = _collateralPools[_collateralPoolId].debtFloor;
        _info.positionDebtCeiling = _collateralPools[_collateralPoolId].positionDebtCeiling;
    }
}
