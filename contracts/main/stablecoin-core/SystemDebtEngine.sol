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

/** @notice A contract which manages the bad debt and the surplus of the system.
    SystemDebtEngine will be the debitor or debtor when a position is liquidated. 
    The debt recorded in the name of SystemDebtEngine will be considered as system bad debt unless it is cleared by liquidation.
    The stability fee will be accrued and kept within SystemDebtEngine. As it is the debtor, therefore SystemDebtEngine should be the holder of the surplus and use it to settle the bad debt.
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

    function withdrawCollateralSurplus(
        bytes32 _collateralPoolId,
        address _to,
        uint256 _amount // [wad]
    ) external onlyOwner {
        bookKeeper.moveCollateral(_collateralPoolId, address(this), _to, _amount);
    }

    function withdrawStablecoinSurplus(address _to, uint256 _value) external onlyOwner {
        require(bookKeeper.systemBadDebt(address(this)) == 0, "SystemDebtEngine/system-bad-debt-remaining");
        require(bookKeeper.stablecoin(address(this)) - _value >= surplusBuffer, "SystemDebtEngine/insufficient-surplus");
        bookKeeper.moveStablecoin(address(this), _to, _value);
    }

    function setSurplusBuffer(uint256 _data) external whenNotPaused onlyOwner {
        require(_data >= 10 ** 45, "SystemDebtEngine/invalidSurplusBuffer");
        surplusBuffer = _data;
        emit LogSetSurplusBuffer(msg.sender, _data);
    }

    /** @dev Settle system bad debt as SystemDebtEngine.
      This function could be called by anyone to settle the system bad debt when there is available surplus.
      The stablecoin held by SystemDebtEngine (which is the surplus) will be deducted to compensate the incurred bad debt.
    */
    function settleSystemBadDebt(uint256 _value) external override whenNotPaused nonReentrant {
        require(_value <= bookKeeper.stablecoin(address(this)), "SystemDebtEngine/insufficient-surplus");
        require(_value <= bookKeeper.systemBadDebt(address(this)), "SystemDebtEngine/insufficient-debt");
        bookKeeper.settleSystemBadDebt(_value);
    }

    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            bookKeeper.settleSystemBadDebt(min(bookKeeper.stablecoin(address(this)), bookKeeper.systemBadDebt(address(this))));
            emit LogCage();
        }
    }

    function uncage() external override onlyOwnerOrShowStopper {
        require(live == 0, "SystemDebtEngine/not-caged");
        live = 1;
        emit LogUncage();
    }

    function pause() external override onlyOwnerOrGov {
        _pause();
    }

    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }
}
