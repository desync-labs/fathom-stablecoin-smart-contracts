// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;





import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStabilityFeeCollector.sol";
import "../interfaces/ICollateralPoolConfig.sol";

/// @title StabilityFeeCollector
/// @author Fathom Fin Corporation
/** @notice A contract which acts as a collector for the stability fee.
        The stability fee is a fee that is collected from the minter of Fathom Stablecoin in a per-seconds basis.
        The stability fee will be accumulated in the system as a surplus to settle any bad debt.
*/

contract StabilityFeeCollector is IStabilityFeeCollector {
    // --- Data ---
    struct CollateralPool {
        uint256 stabilityFeeRate; // Collateral-specific, per-second stability fee debtAccumulatedRate or mint interest debtAccumulatedRate [ray]
        uint256 lastAccumulationTime; // Time of last call to `collect` [unix epoch time]
    }

    IBookKeeper public bookKeeper;
    address public systemDebtEngine;
    uint256 public globalStabilityFeeRate; // Global, per-second stability fee debtAccumulatedRate [ray]

    // --- Init ---
    constructor(address _bookKeeper, address _systemDebtEngine) public {
        bookKeeper = IBookKeeper(_bookKeeper);
        require(_systemDebtEngine != address(0), "StabilityFeeCollector/bad-system-debt-engine-address");
        systemDebtEngine = _systemDebtEngine;
    }

    // --- Math ---
    function rpow(
        uint256 x, //<- _stabilityFeeRate 1.E+27    1.000x RAY
        uint256 n, //<- _lastAccumulationtime    31536000
        uint256 b //<-10**27 1 RAY
    ) internal pure returns (uint256 z) {
        assembly {
            switch x
            case 0 {
                switch n
                case 0 {
                    z := b
                }
                default {
                    z := 0
                }
            }
            default {
                switch mod(n, 2)
                case 0 {     //even
                    z := b
                }
                default {    //odd
                    z := x
                }
                let half := div(b, 2) // for rounding.
                for {
                    n := div(n, 2)
                } n {
                    n := div(n, 2)
                } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) {
                        revert(0, 0)
                    }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) {
                        revert(0, 0)
                    }
                    x := div(xxRound, b)
                    if mod(n, 2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {
                            revert(0, 0)
                        }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) {
                            revert(0, 0)
                        }
                        z := div(zxRound, b)
                    }
                }
            }
        }
    }

    uint256 constant RAY = 10**27;

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = _x + _y;
        require(_z >= _x);
    }

    function diff(uint256 _x, uint256 _y) internal pure returns (int256 _z) {
        _z = int256(_x) - int256(_y);
        require(int256(_x) >= 0 && int256(_y) >= 0);
    }

    function rmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = _x * _y;
        require(_y == 0 || _z / _y == _x);
        _z = _z / RAY;
    }

    // --- Administration ---
    event LogSetGlobalStabilityFeeRate(address indexed _caller, uint256 _data);
    event LogSetSystemDebtEngine(address indexed _caller, address _data);


    /// @dev Set the global stability fee debtAccumulatedRate which will be apply to every collateral pool. Please see the explanation on the input format from the `setStabilityFeeRate` function.
    /// @param _globalStabilityFeeRate Global stability fee debtAccumulatedRate [ray]
    /// @dev access: OWNER_ROLE
    function setGlobalStabilityFeeRate(uint256 _globalStabilityFeeRate) external {
        require(
            _globalStabilityFeeRate == 0 || _globalStabilityFeeRate >= RAY,
            "StabilityFeeCollector/invalid-stability-fee-rate"
        );
        // Maximum stability fee rate is 50% yearly
        require(
            _globalStabilityFeeRate <= 1000000012857214317438491659,
            "StabilityFeeCollector/stability-fee-rate-too-large"
        );
        globalStabilityFeeRate = _globalStabilityFeeRate;
        emit LogSetGlobalStabilityFeeRate(msg.sender, _globalStabilityFeeRate);
    }

    /// @dev access: OWNER_ROLE
    function setSystemDebtEngine(address _systemDebtEngine) external {
        require(_systemDebtEngine != address(0), "StabilityFeeCollector/bad-system-debt-engine-address");
        systemDebtEngine = _systemDebtEngine;
        emit LogSetSystemDebtEngine(msg.sender, _systemDebtEngine);
    }

    // --- Stability Fee Collection ---
    /** @dev Collect the stability fee of the collateral pool.
            This function could be called by anyone.
            It will update the `debtAccumulatedRate` of the specified collateral pool according to
            the global and per-pool stability fee rates with respect to the last block that `collect` was called.
    */
    /// @param _collateralPool Collateral pool id
    function collect(bytes32 _collateralPool)
        external
        override
        returns (uint256 _debtAccumulatedRate)
    {
        _debtAccumulatedRate = _collect(_collateralPool);
    }

    function _collect(bytes32 _collateralPoolId) internal returns (uint256 _debtAccumulatedRate) {
        uint256 _previousDebtAccumulatedRate = ICollateralPoolConfig(bookKeeper.collateralPoolConfig())
            .getDebtAccumulatedRate(_collateralPoolId);
        uint256 _stabilityFeeRate = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getStabilityFeeRate(
            _collateralPoolId
        );
        uint256 _lastAccumulationTime = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getLastAccumulationTime(
            _collateralPoolId
        );
        require(now >= _lastAccumulationTime, "StabilityFeeCollector/invalid-now");
        require(systemDebtEngine != address(0), "StabilityFeeCollector/system-debt-engine-not-set");

        // debtAccumulatedRate [ray]
        _debtAccumulatedRate = rmul(
            rpow(add(globalStabilityFeeRate, _stabilityFeeRate), now - _lastAccumulationTime, RAY),
            _previousDebtAccumulatedRate
        );
        bookKeeper.accrueStabilityFee(
            _collateralPoolId,
            systemDebtEngine,
            diff(_debtAccumulatedRate, _previousDebtAccumulatedRate)
        );
        ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).updateLastAccumulationTime(_collateralPoolId);
    }
}
