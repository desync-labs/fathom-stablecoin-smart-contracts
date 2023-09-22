// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStabilityFeeCollector.sol";
import "../interfaces/IPausable.sol";
import "../utils/CommonMath.sol";

/**
 * @title StabilityFeeCollector
 * @notice A contract that acts as a collector for the stability fee.
 * The stability fee is a fee that is collected from the minter of Fathom Stablecoin on a per-seconds basis.
 * This fee is accumulated in the system as a surplus to settle any bad debt.
 * The contract is Pausable, meaning it can be paused by the owner or governance to prevent fee collection temporarily.
 * Stability fees are collected for each collateral pool separately.
 */
contract StabilityFeeCollector is CommonMath, PausableUpgradeable, ReentrancyGuardUpgradeable, IStabilityFeeCollector, IPausable {
    struct CollateralPool {
        uint256 stabilityFeeRate; // Collateral-specific, per-second stability fee debtAccumulatedRate or mint interest debtAccumulatedRate [ray]
        uint256 lastAccumulationTime; // Time of last call to `collect` [unix epoch time]
    }

    IBookKeeper public bookKeeper;
    address public systemDebtEngine;

    event LogSetSystemDebtEngine(address indexed _caller, address _data);

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

    function initialize(address _bookKeeper, address _systemDebtEngine) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        require(_bookKeeper != address(0), "StabilityFeeCollector/zero-book-keeper");
        bookKeeper = IBookKeeper(_bookKeeper);
        
        require(_systemDebtEngine != address(0), "StabilityFeeCollector/bad-system-debt-engine-address");
        systemDebtEngine = _systemDebtEngine;
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external override onlyOwnerOrGov {
        _pause();
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }

    function setSystemDebtEngine(address _systemDebtEngine) external onlyOwner {
        require(_systemDebtEngine != address(0), "StabilityFeeCollector/bad-system-debt-engine-address");
        systemDebtEngine = _systemDebtEngine;
        emit LogSetSystemDebtEngine(msg.sender, _systemDebtEngine);
    }

    /**
     * @dev Collects the stability fee of the specified collateral pool.
     * This function can be called by anyone.
     * It updates the `debtAccumulatedRate` of the specified collateral pool based on
     * the global and per-pool stability fee rates with respect to the last block that `collect` was called.
     * @param _collateralPool Collateral pool ID for which to collect the stability fee.
     * @return _debtAccumulatedRate Updated debtAccumulatedRate for the specified collateral pool.
     */
    function collect(bytes32 _collateralPool) external override whenNotPaused nonReentrant returns (uint256 _debtAccumulatedRate) {
        _debtAccumulatedRate = _collect(_collateralPool);
    }
    /**
     * @dev Internal function to collect the stability fee of the specified collateral pool.
     * This function updates the `debtAccumulatedRate` of the specified collateral pool based on
     * the global and per-pool stability fee rates with respect to the last block that `collect` was called.
     * @param _collateralPoolId Collateral pool ID for which to collect the stability fee.
     * @return _debtAccumulatedRate Updated debtAccumulatedRate for the specified collateral pool.
     */
    function _collect(bytes32 _collateralPoolId) internal returns (uint256 _debtAccumulatedRate) {
        ICollateralPoolConfig _config = ICollateralPoolConfig(bookKeeper.collateralPoolConfig());
        
        uint256 _previousDebtAccumulatedRate = _config.getDebtAccumulatedRate(_collateralPoolId);
        uint256 _stabilityFeeRate = _config.getStabilityFeeRate(_collateralPoolId);
        uint256 _lastAccumulationTime = _config.getLastAccumulationTime(_collateralPoolId);
        require(block.timestamp >= _lastAccumulationTime, "StabilityFeeCollector/invalid-block.timestamp");
        require(systemDebtEngine != address(0), "StabilityFeeCollector/system-debt-engine-not-set");

        _debtAccumulatedRate = rmul(rpow(_stabilityFeeRate, block.timestamp - _lastAccumulationTime, RAY), _previousDebtAccumulatedRate);

        bookKeeper.accrueStabilityFee(_collateralPoolId, systemDebtEngine, diff(_debtAccumulatedRate, _previousDebtAccumulatedRate));
        _config.updateLastAccumulationTime(_collateralPoolId);
    }
}
