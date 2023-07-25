// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/IPausable.sol";
import "../utils/CommonMath.sol";

/**
 * @title SystemDebtEngine
 * @notice A contract that manages the bad debt and surplus of the system.
 * The SystemDebtEngine acts as the debitor or debtor when a position is liquidated.
 * The debt recorded in the name of SystemDebtEngine will be considered as system bad debt unless it is cleared by liquidation.
 * The stability fee will be accrued and kept within the SystemDebtEngine, which acts as the holder of the surplus and uses it to settle bad debt.
 * The contract is Pausable, meaning it can be paused by the owner or governance to temporarily prevent certain actions.
 * It is also protected against reentrancy attacks using the ReentrancyGuard modifier.
 * The contract has an active flag, live, which allows for system shutdown.
 */

contract SystemDebtEngine is CommonMath, PausableUpgradeable, ReentrancyGuardUpgradeable, ISystemDebtEngine, ICagable, IPausable {
    IBookKeeper public bookKeeper; // CDP Engine
    uint256 public override surplusBuffer; // Surplus buffer         [rad]
    uint256 public live; // Active Flag

    event LogSetSurplusBuffer(address indexed _caller, uint256 _data);

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

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    function initialize(address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        require(_bookKeeper != address(0), "SystemDebtEngine/zero-book-keeper");
        bookKeeper = IBookKeeper(_bookKeeper);
        live = 1;
    }
    /**
    * @notice Withdraw collateral surplus from a collateral pool
    * @dev This function allows the contract owner to withdraw a surplus amount of collateral from a specific collateral pool.
    *      The surplus is the excess collateral that is not currently being used as collateral for any outstanding debt.
    * @param _collateralPoolId The identifier of the collateral pool from which the surplus collateral will be withdrawn.
    * @param _to The address to which the surplus collateral will be transferred.
    * @param _amount The amount of surplus collateral to be withdrawn. [wad] 
    * @dev Reverts if the caller is not the contract owner.
    */
    function withdrawCollateralSurplus(
        bytes32 _collateralPoolId,
        address _to,
        uint256 _amount // [wad]
    ) external onlyOwner {
        bookKeeper.moveCollateral(_collateralPoolId, address(this), _to, _amount);
    }
    /**
    * @notice Withdraw stablecoin surplus from the SystemDebtEngine
    * @dev This function allows the contract owner to withdraw a surplus amount of stablecoin from the SystemDebtEngine.
    *      The surplus is the excess stablecoin that is not currently being used to settle bad debt.
    *      Before withdrawing the surplus, the function checks that there is no remaining system bad debt.
    *      Additionally, the function ensures that after the withdrawal, the remaining stablecoin balance in the SystemDebtEngine
    *      is greater than or equal to the defined surplus buffer.
    * @param _to The address to which the surplus stablecoin will be transferred.
    * @param _value The amount of surplus stablecoin to be withdrawn.
    * @dev Reverts if the caller is not the contract owner or if the system bad debt is still remaining.
    *      Also reverts if the remaining stablecoin balance after withdrawal would be less than the surplus buffer.
    */
    function withdrawStablecoinSurplus(address _to, uint256 _value) external onlyOwner {
        require(bookKeeper.systemBadDebt(address(this)) == 0, "SystemDebtEngine/system-bad-debt-remaining");
        require(bookKeeper.stablecoin(address(this)) - _value >= surplusBuffer, "SystemDebtEngine/insufficient-surplus");
        bookKeeper.moveStablecoin(address(this), _to, _value);
    }
    /**
    * @notice Set the surplus buffer
    * @dev This function is used to set the surplus buffer, which represents the minimum amount of surplus stablecoin
    *      that should be maintained in the SystemDebtEngine.
    * @param _data The new value for the surplus buffer.
    * @dev Reverts if the provided surplus buffer value is less than 10^45.
    *      The surplus buffer should be set to a value large enough to cover potential bad debt settlements.
    *      It acts as a safety measure to ensure the system remains solvent.
    */
    function setSurplusBuffer(uint256 _data) external whenNotPaused onlyOwner {
        require(_data >= 10 ** 45, "SystemDebtEngine/invalidSurplusBuffer");
        surplusBuffer = _data;
        emit LogSetSurplusBuffer(msg.sender, _data);
    }

    /**
     * @notice Settle system bad debt as SystemDebtEngine.
     * This function could be called by anyone to settle the system bad debt when there is available surplus.
     * The stablecoin held by SystemDebtEngine (which is the surplus) will be deducted to compensate the incurred bad debt.
     * @param _value The amount of stablecoin to be used for settling the bad debt. 
     * @dev This function allows the system to settle its bad debt using the available surplus. 
     *      It requires that the caller passes an amount of stablecoin they want to use for settling the debt.
     *      If the available surplus is sufficient, the specified amount of stablecoin is deducted from the surplus, 
     *      and the corresponding bad debt is settled. 
     *      If the surplus is not enough to cover the specified amount of debt, the function will revert.
     *      It is essential to settle bad debt to maintain the stability and integrity of the system.
     */
    function settleSystemBadDebt(uint256 _value) external override whenNotPaused nonReentrant {
        require(_value <= bookKeeper.stablecoin(address(this)), "SystemDebtEngine/insufficient-surplus");
        require(_value <= bookKeeper.systemBadDebt(address(this)), "SystemDebtEngine/insufficient-debt");
        bookKeeper.settleSystemBadDebt(_value);
    }
    /**
     * @notice Enable the contract for the emergency shutdown
     * @dev This function is used to stop the operation of the contract for the emergency shutdown.
     *      It can be called by the contract owner or a role designated as 'ShowStopper'.
     *      If the contract is live (active), the function will deactivate the contract and stop its operations. 
     *      Before shutting down, the function attempts to settle any existing bad debt using available surplus. 
     *      After successful shutdown, the contract will no longer perform its functions until it is uncaged.
     */
    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            bookKeeper.settleSystemBadDebt(min(bookKeeper.stablecoin(address(this)), bookKeeper.systemBadDebt(address(this))));
            emit LogCage();
        }
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
