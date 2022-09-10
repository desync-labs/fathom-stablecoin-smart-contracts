// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;




import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/ICagable.sol";

/// @title SystemDebtEngine
/// @author Fathom Fin Corporation
/** @notice A contract which manages the bad debt and the surplus of the system.
        SystemDebtEngine will be the debitor or debtor when a position is liquidated. 
        The debt recorded in the name of SystemDebtEngine will be considered as system bad debt unless it is cleared by liquidation.
        The stability fee will be accrued and kept within SystemDebtEngine. As it is the debtor, therefore SystemDebtEngine should be the holder of the surplus and use it to settle the bad debt.
*/

contract SystemDebtEngine is ISystemDebtEngine, ICagable {
    // --- Data ---
    IBookKeeper public bookKeeper; // CDP Engine
    uint256 public override surplusBuffer; // Surplus buffer                 [rad]
    uint256 public live; // Active Flag

    // --- Init ---
    constructor(address _bookKeeper) public {
        bookKeeper = IBookKeeper(_bookKeeper);
        live = 1;
    }

    // --- Math ---
    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    function min(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        return _x <= _y ? _x : _y;
    }

    // --- withdraw surplus ---
    /// @param _amount The amount of collateral. [wad]
    /// @dev access: OWNER_ROLE
    function withdrawCollateralSurplus(
        bytes32 _collateralPoolId,
        IGenericTokenAdapter _adapter,
        address _to,
        uint256 _amount // [wad]
    ) external {
        bookKeeper.moveCollateral(_collateralPoolId, address(this), _to, _amount);
        _adapter.onMoveCollateral(address(this), _to, _amount, abi.encode(_to));
    }

    /// @param _value The value of collateral. [rad]
    /// @dev access: OWNER_ROLE
    function withdrawStablecoinSurplus(address _to, uint256 _value) external {
        require(bookKeeper.systemBadDebt(address(this)) == 0, "SystemDebtEngine/system-bad-debt-remaining");
        require(
            sub(bookKeeper.stablecoin(address(this)), _value) >= surplusBuffer,
            "SystemDebtEngine/insufficient-surplus"
        );
        bookKeeper.moveStablecoin(address(this), _to, _value);
    }

    // --- Administration ---
    event LogSetSurplusBuffer(address indexed _caller, uint256 _data);

    /// @dev access: OWNER_ROLE
    function setSurplusBuffer(uint256 _data) external {
        surplusBuffer = _data;
        emit LogSetSurplusBuffer(msg.sender, _data);
    }

    // Debt settlement
    /** @dev Settle system bad debt as SystemDebtEngine.
            This function could be called by anyone to settle the system bad debt when there is available surplus.
            The stablecoin held by SystemDebtEngine (which is the surplus) will be deducted to compensate the incurred bad debt.
    */
    /// @param _value The value of bad debt to be settled. [rad]
    function settleSystemBadDebt(uint256 _value) external override {
        require(_value <= bookKeeper.stablecoin(address(this)), "SystemDebtEngine/insufficient-surplus");
        require(_value <= bookKeeper.systemBadDebt(address(this)), "SystemDebtEngine/insufficient-debt");
        bookKeeper.settleSystemBadDebt(_value);
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function cage() external override {
        require(live == 1, "SystemDebtEngine/not-live");
        live = 0;
        bookKeeper.settleSystemBadDebt(min(bookKeeper.stablecoin(address(this)), bookKeeper.systemBadDebt(address(this))));
        emit LogCage();
    }

    /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
    function uncage() external override {
        require(live == 0, "SystemDebtEngine/not-caged");
        live = 1;
        emit LogUncage();
    }
}
