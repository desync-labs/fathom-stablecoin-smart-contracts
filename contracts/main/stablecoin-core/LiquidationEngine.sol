// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/ILiquidationEngine.sol";
import "../interfaces/ILiquidationStrategy.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/ISetPrice.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IPausable.sol";

/// @title LiquidationEngine
/** @notice A contract which is the manager for all of the liquidations of the protocol.
    LiquidationEngine will be the interface for the liquidator to trigger any positions into the liquidation process.
*/

contract LiquidationEngine is PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable, ILiquidationEngine, IPausable {
  using SafeMathUpgradeable for uint256;
  address public priceOracle;

  struct LocalVars {
    uint256 positionLockedCollateral;
    uint256 positionDebtShare;
    uint256 systemDebtEngineStablecoinBefore;
    uint256 newPositionLockedCollateral;
    uint256 newPositionDebtShare;
    uint256 wantStablecoinValueFromLiquidation;
  }

  struct CollateralPoolLocalVars {
    address strategy;
    uint256 priceWithSafetyMargin; // [ray]
    uint256 debtAccumulatedRate; // [ray]
  }

  IBookKeeper public bookKeeper; // CDP Engine
  ISystemDebtEngine public systemDebtEngine; // Debt Engine
  uint256 public override live; // Active Flag
  mapping(address => uint256) public liquidatorsWhitelist;

  event LiquidationFail(bytes32 _collateralPoolIds, address _positionAddresses, address _liquidator, string reason);

  modifier onlyOwnerOrShowStopper() {
    IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
    require(
      _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
        _accessControlConfig.hasRole(_accessControlConfig.SHOW_STOPPER_ROLE(), msg.sender),
      "!(ownerRole or showStopperRole)"
    );
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
  
  modifier onlyOwner() {
    IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
    require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
    _;
  }

    modifier onlyWhitelisted() {
    require(liquidatorsWhitelist[msg.sender] == 1, "LiquidationEngine/liquidator-not-whitelisted");
    _;
  }

  // --- Init ---
  function initialize(address _bookKeeper, address _systemDebtEngine, address _priceOracle) external initializer {
    PausableUpgradeable.__Pausable_init();
    ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

    require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "LiquidationEngine/invalid-bookKeeper"); // Sanity Check Call
    bookKeeper = IBookKeeper(_bookKeeper);

    require(ISystemDebtEngine(_systemDebtEngine).surplusBuffer() >= 0, "LiquidationEngine/invalid-systemDebtEngine"); // Sanity Check Call
    systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
    
    require(IPriceOracle(_priceOracle).stableCoinReferencePrice() >= 0, "LiquidationEngine/invalid-priceOracle"); // Sanity Check Call
    priceOracle = _priceOracle;
    live = 1;
  }

  // --- Math ---
  uint256 constant WAD = 10**18;

  function whitelist(address toBeWhitelisted) external onlyOwnerOrGov {
    require(toBeWhitelisted != address(0), "LiquidationEngine/whitelist-invalidAddress");
    liquidatorsWhitelist[toBeWhitelisted] = 1;
  }

  function blacklist(address toBeRemoved) external onlyOwnerOrGov {
    liquidatorsWhitelist[toBeRemoved] = 0;
  }

  function batchLiquidate(
    bytes32[] calldata _collateralPoolIds,
    address[] calldata _positionAddresses,
    uint256[] calldata _debtShareToBeLiquidateds, // [rad]
    uint256[] calldata _maxDebtShareToBeLiquidateds, // [rad]
    address[] calldata _collateralRecipients,
    bytes[] calldata datas
  ) external override nonReentrant whenNotPaused onlyWhitelisted {

    require(_collateralPoolIds.length == _positionAddresses.length &&
            _collateralPoolIds.length == _debtShareToBeLiquidateds.length && 
            _collateralPoolIds.length == _maxDebtShareToBeLiquidateds.length && 
            _collateralPoolIds.length == _collateralRecipients.length && 
            _collateralPoolIds.length == datas.length 
             ,"LiquidationEngine/batchLiquidate-invalid-arguments");

    for(uint i = 0; i < _collateralPoolIds.length; i++){
        try this.liquidate(_collateralPoolIds[i], _positionAddresses[i],_debtShareToBeLiquidateds[i], _maxDebtShareToBeLiquidateds[i], _collateralRecipients[i], datas[i],msg.sender){
        } catch Error(string memory reason) {
            emit LiquidationFail(_collateralPoolIds[i], _positionAddresses[i], msg.sender, reason);
            continue;
        } catch Panic(uint errorCode) {
          emit LiquidationFail(_collateralPoolIds[i], _positionAddresses[i], msg.sender, "panic error");
            continue;
        } catch (bytes memory lowLevelData) {
          string memory errorData = string(lowLevelData);
          emit LiquidationFail(_collateralPoolIds[i], _positionAddresses[i], msg.sender, errorData);
            continue;
        }
    }
  }

  //This function is overload implementation of liquidate() and will only be called from LiquidationEngine contract to support batch liquidation, 
  function liquidate(
    bytes32 _collateralPoolId,
    address _positionAddress,
    uint256 _debtShareToBeLiquidated, // [rad]
    uint256 _maxDebtShareToBeLiquidated, // [wad]
    address _collateralRecipient,
    bytes calldata _data,
    address sender
  ) external override whenNotPaused {
    require(msg.sender == address(this),"LiquidationEngine/invalid-sender");
    _liquidate(_collateralPoolId, _positionAddress, _debtShareToBeLiquidated,_maxDebtShareToBeLiquidated, _collateralRecipient, _data,sender);
  }


  function liquidate(
    bytes32 _collateralPoolId,
    address _positionAddress,
    uint256 _debtShareToBeLiquidated, // [rad]
    uint256 _maxDebtShareToBeLiquidated, // [wad]
    address _collateralRecipient,
    bytes calldata _data
  ) external override nonReentrant whenNotPaused onlyWhitelisted {
    _liquidate(_collateralPoolId, _positionAddress, _debtShareToBeLiquidated,_maxDebtShareToBeLiquidated, _collateralRecipient, _data, msg.sender);
  }

  function _liquidate(
    bytes32 _collateralPoolId,
    address _positionAddress,
    uint256 _debtShareToBeLiquidated, // [rad]
    uint256 _maxDebtShareToBeLiquidated, // [wad]
    address _collateralRecipient,
    bytes calldata _data,
    address sender
  ) internal {

    require(live == 1, "LiquidationEngine/not-live");
    require(_debtShareToBeLiquidated != 0, "LiquidationEngine/zero-debt-value-to-be-liquidated");
    require(_maxDebtShareToBeLiquidated != 0, "LiquidationEngine/zero-max-debt-value-to-be-liquidated");
    require(_isPriceOk(_collateralPoolId), "LiquidationEngine/price-is-not-healthy");

    LocalVars memory _vars;

    (_vars.positionLockedCollateral, _vars.positionDebtShare) = bookKeeper.positions(
      _collateralPoolId,
      _positionAddress
    );
    // 1. Check if the position is underwater
    CollateralPoolLocalVars memory _collateralPoolLocalVars;
    _collateralPoolLocalVars.strategy = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getStrategy(
      _collateralPoolId
    );
    _collateralPoolLocalVars.priceWithSafetyMargin = ICollateralPoolConfig(bookKeeper.collateralPoolConfig())
      .getPriceWithSafetyMargin(_collateralPoolId); // [ray]
    _collateralPoolLocalVars.debtAccumulatedRate = ICollateralPoolConfig(bookKeeper.collateralPoolConfig())
      .getDebtAccumulatedRate(_collateralPoolId); // [ray]

    ILiquidationStrategy _strategy = ILiquidationStrategy(_collateralPoolLocalVars.strategy);
    require(address(_strategy) != address(0), "LiquidationEngine/not-set-strategy");

    // (positionLockedCollateral [wad] * priceWithSafetyMargin [ray]) [rad]
    // (positionDebtShare [wad] * debtAccumulatedRate [ray]) [rad]
    require(
      _collateralPoolLocalVars.priceWithSafetyMargin > 0 &&
        _vars.positionLockedCollateral.mul(_collateralPoolLocalVars.priceWithSafetyMargin) <
        _vars.positionDebtShare.mul(_collateralPoolLocalVars.debtAccumulatedRate),
      "LiquidationEngine/position-is-safe"
    );

    _vars.systemDebtEngineStablecoinBefore = bookKeeper.stablecoin(address(systemDebtEngine));

    _strategy.execute(
      _collateralPoolId,
      _vars.positionDebtShare,
      _vars.positionLockedCollateral,
      _positionAddress,
      _debtShareToBeLiquidated,
      _maxDebtShareToBeLiquidated,
      sender,
      _collateralRecipient,
      _data
    );
    (_vars.newPositionLockedCollateral, _vars.newPositionDebtShare) = bookKeeper.positions(
      _collateralPoolId,
      _positionAddress
    );
    require(_vars.newPositionDebtShare < _vars.positionDebtShare, "LiquidationEngine/debt-not-liquidated");

    // (positionDebtShare [wad] - newPositionDebtShare [wad]) * debtAccumulatedRate [ray]

    _vars.wantStablecoinValueFromLiquidation = _vars.positionDebtShare.sub(_vars.newPositionDebtShare).mul(
      _collateralPoolLocalVars.debtAccumulatedRate
    ); // [rad]
    require(
      bookKeeper.stablecoin(address(systemDebtEngine)).sub(_vars.systemDebtEngineStablecoinBefore) >=
        _vars.wantStablecoinValueFromLiquidation,
      "LiquidationEngine/payment-not-received"
    );

    // If collateral has been depleted from liquidation whilst there is remaining debt in the position
    if (_vars.newPositionLockedCollateral == 0 && _vars.newPositionDebtShare > 0) {
      // Overflow check
      require(_vars.newPositionDebtShare < 2**255, "LiquidationEngine/overflow");
      // Record the bad debt to the system and close the position
      bookKeeper.confiscatePosition(
        _collateralPoolId,
        _positionAddress,
        _positionAddress,
        address(systemDebtEngine),
        0,
        -int256(_vars.newPositionDebtShare)
      );
    }

    ISetPrice(priceOracle).setPrice(_collateralPoolId);
  }

  function setPriceOracle(address _priceOracle) external onlyOwnerOrShowStopper {
    require(live == 1, "LiquidationEngine/not-live");
    require(IPriceOracle(_priceOracle).stableCoinReferencePrice() >= 0, "LiquidationEngine/invalid-priceOracle"); // Sanity Check Call
    priceOracle = _priceOracle;
  }

  function setBookKeeper(address _bookKeeper) external onlyOwner {
    require(live == 1, "LiquidationEngine/not-live");
    require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "LiquidationEngine/invalid-bookKeeper"); // Sanity Check Call
    bookKeeper = IBookKeeper(_bookKeeper);
  }

  /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
  function cage() external override onlyOwnerOrShowStopper {
    if (live == 1) {
        live = 0;
        emit LogCage();
    }
  }

  /// @dev access: OWNER_ROLE, SHOW_STOPPER_ROLE
  function uncage() external override onlyOwnerOrShowStopper {
    require(live == 0, "LiquidationEngine/not-caged");
    live = 1;
    emit LogUncage();
  }

  // --- pause ---
  /// @dev access: OWNER_ROLE, GOV_ROLE
  function pause() external override onlyOwnerOrGov {
    _pause();
  }

  /// @dev access: OWNER_ROLE, GOV_ROLE
  function unpause() external override onlyOwnerOrGov {
    _unpause();
  }

  function _isPriceOk(bytes32 _collateralPoolId) internal view returns (bool) {
    IPriceFeed _priceFeed = IPriceFeed(ICollateralPoolConfig(IBookKeeper(bookKeeper).collateralPoolConfig()).getPriceFeed(_collateralPoolId));
    return _priceFeed.isPriceOk();
  }
}