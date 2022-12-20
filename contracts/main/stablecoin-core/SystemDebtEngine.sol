// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/ICagable.sol";

/** @notice A contract which manages the bad debt and the surplus of the system.
    SystemDebtEngine will be the debitor or debtor when a position is liquidated. 
    The debt recorded in the name of SystemDebtEngine will be considered as system bad debt unless it is cleared by liquidation.
    The stability fee will be accrued and kept within SystemDebtEngine. As it is the debtor, therefore SystemDebtEngine should be the holder of the surplus and use it to settle the bad debt.
*/
contract SystemDebtEngine is PausableUpgradeable, ReentrancyGuardUpgradeable, ISystemDebtEngine, ICagable {
    IBookKeeper public bookKeeper; // CDP Engine
    uint256 public override surplusBuffer; // Surplus buffer         [rad]
    uint256 public live; // Active Flag

    function initialize(address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        bookKeeper = IBookKeeper(_bookKeeper);
        live = 1;
    }

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    function min(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        return _x <= _y ? _x : _y;
    }

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwnerOrShowStopper() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
            "!(ownerRole or showStopperRole)"
        );
        _;
    }

    function withdrawCollateralSurplus(
        bytes32 _collateralPoolId,
        IGenericTokenAdapter _adapter,
        address _to,
        uint256 _amount // [wad]
    ) external onlyOwner {
        bookKeeper.moveCollateral(_collateralPoolId, address(this), _to, _amount);
        _adapter.onMoveCollateral(address(this), _to, _amount, abi.encode(_to));
    }

    function withdrawStablecoinSurplus(address _to, uint256 _value) external onlyOwner {
        require(bookKeeper.systemBadDebt(address(this)) == 0, "SystemDebtEngine/system-bad-debt-remaining");
        require(sub(bookKeeper.stablecoin(address(this)), _value) >= surplusBuffer, "SystemDebtEngine/insufficient-surplus");
        bookKeeper.moveStablecoin(address(this), _to, _value);
    }

    event LogSetSurplusBuffer(address indexed _caller, uint256 _data);

    function setSurplusBuffer(uint256 _data) external whenNotPaused onlyOwner {
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
        require(live == 1, "SystemDebtEngine/not-live");
        live = 0;
        bookKeeper.settleSystemBadDebt(min(bookKeeper.stablecoin(address(this)), bookKeeper.systemBadDebt(address(this))));
        emit LogCage();
    }

    function uncage() external override onlyOwnerOrShowStopper {
        require(live == 0, "SystemDebtEngine/not-caged");
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
