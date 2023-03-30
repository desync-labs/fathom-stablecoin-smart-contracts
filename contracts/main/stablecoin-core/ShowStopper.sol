// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IShowStopper.sol";
import "../interfaces/ILiquidationEngine.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/ISystemDebtEngine.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/ICagable.sol";

contract ShowStopper is PausableUpgradeable, IShowStopper {
    IBookKeeper public bookKeeper; // CDP Engine
    ILiquidationEngine public liquidationEngine;
    ISystemDebtEngine public systemDebtEngine; // Debt Engine
    IPriceOracle public priceOracle;

    uint256 public override live; // Active Flag
    uint256 public cagedTimestamp; // Time of cage                   [unix epoch time]
    uint256 public cageCoolDown; // Processing Cooldown Length             [seconds]
    uint256 public debt; // Total outstanding stablecoin following processing [rad]

    mapping(bytes32 => uint256) public cagePrice; // Cage price              [ray]
    mapping(bytes32 => uint256) public badDebtAccumulator; // Collateral badDebtAccumulator    [wad]
    mapping(bytes32 => uint256) public totalDebtShare; // Total debt per collateralPoolId      [wad]
    mapping(bytes32 => uint256) public finalCashPrice; // Final redeemStablecoin price        [ray]

    mapping(address => uint256) public stablecoinAccumulator; //    [wad]
    mapping(bytes32 => mapping(address => uint256)) public redeemedStablecoinAmount; //    [wad]

    event LogCage();
    event LogCageCollateralPool(bytes32 indexed collateralPoolId);

    event LogAccumulateBadDebt(bytes32 indexed collateralPoolId, address indexed positionAddress, uint256 amount, uint256 debtShare);
    event LogRedeemLockedCollateral(bytes32 indexed collateralPoolId, address indexed positionAddress, uint256 lockedCollateral);
    event LogFinalizeDebt();
    event LogFinalizeCashPrice(bytes32 indexed collateralPoolId);
    event LogAccumulateStablecoin(address indexed ownerAddress, uint256 amount);
    event LogRedeemStablecoin(bytes32 indexed collateralPoolId, address indexed ownerAddress, uint256 amount);

    function initialize(address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "ShowStopper/invalid-bookKeeper"); // Sanity Check Call
        bookKeeper = IBookKeeper(_bookKeeper);
        live = 1;
    }

    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = _x + _y;
        require(_z >= _x);
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x);
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x);
    }

    function min(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        return _x <= _y ? _x : _y;
    }

    function rmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, _y) / RAY;
    }

    function wdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, WAD) / _y;
    }

    event LogSetBookKeeper(address indexed caller, address _bookKeeper);
    event LogSetLiquidationEngine(address indexed caller, address _liquidationEngine);
    event LogSetSystemDebtEngine(address indexed caller, address _systemDebtEngine);
    event LogSetPriceOracle(address indexed caller, address _priceOracle);
    event LogSetCageCoolDown(address indexed caller, uint256 _cageCoolDown);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    function setBookKeeper(address _bookKeeper) external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "ShowStopper/invalid-bookKeeper"); // Sanity Check Call
        bookKeeper = IBookKeeper(_bookKeeper);
        emit LogSetBookKeeper(msg.sender, _bookKeeper);
    }

    function setLiquidationEngine(address _liquidationEngine) external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        liquidationEngine = ILiquidationEngine(_liquidationEngine);
        emit LogSetLiquidationEngine(msg.sender, _liquidationEngine);
    }

    function setSystemDebtEngine(address _systemDebtEngine) external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        systemDebtEngine = ISystemDebtEngine(_systemDebtEngine);
        emit LogSetSystemDebtEngine(msg.sender, _systemDebtEngine);
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        priceOracle = IPriceOracle(_priceOracle);
        emit LogSetPriceOracle(msg.sender, _priceOracle);
    }

    function setCageCoolDown(uint256 _cageCoolDown) external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        cageCoolDown = _cageCoolDown;
        emit LogSetCageCoolDown(msg.sender, _cageCoolDown);
    }

    /** @dev Start the process of emergency shutdown. The following will happen in order:
      - Start a cooldown period of the emergency shutdown
      - BookKeeper will be paused: locking/unlocking collateral and mint/repay Fathom Stablecoin will not be allow for any positions
      - LiquidationEngine will be paused: positions will not be liquidated
      - SystemDebtEngine will be paused: no accrual of new debt, no system debt settlement
      - PriceOracle will be paused: no new price update, no liquidation trigger
    */
    function cage() external onlyOwner {
        require(live == 1, "ShowStopper/not-live");
        live = 0;
        cagedTimestamp = block.timestamp;
        ICagable(address(bookKeeper)).cage();
        ICagable(address(liquidationEngine)).cage();
        ICagable(address(systemDebtEngine)).cage();
        ICagable(address(priceOracle)).cage();
        emit LogCage();
    }

    /// @dev Set the cage price of the collateral pool with the latest price from the price oracle
    function cagePool(bytes32 _collateralPoolId) external onlyOwner {
        require(live == 0, "ShowStopper/still-live");
        require(cagePrice[_collateralPoolId] == 0, "ShowStopper/cage-price-collateral-pool-id-already-defined");
        uint256 _totalDebtShare = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getTotalDebtShare(_collateralPoolId);
        address _priceFeedAddress = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getPriceFeed(_collateralPoolId);
        IPriceFeed _priceFeed = IPriceFeed(_priceFeedAddress);
        totalDebtShare[_collateralPoolId] = _totalDebtShare;
        cagePrice[_collateralPoolId] = wdiv(priceOracle.stableCoinReferencePrice(), uint256(_priceFeed.readPrice()));
        emit LogCageCollateralPool(_collateralPoolId);
    }

    /** @dev Inspect the specified position and use the cage price of the collateral pool id to calculate the current badDebtAccumulator of the position.
      The badDebtAccumulator will be tracked per collateral pool. It will be used in the determination of the stablecoin redemption price 
      to make sure that all badDebtAccumulator will be covered. This process will clear the debt from the position.
  */
    function accumulateBadDebt(bytes32 _collateralPoolId, address _positionAddress) external {
        require(cagePrice[_collateralPoolId] != 0, "ShowStopper/cage-price-collateral-pool-id-not-defined");
        uint256 _debtAccumulatedRate = ICollateralPoolConfig(IBookKeeper(bookKeeper).collateralPoolConfig()).getDebtAccumulatedRate(
            _collateralPoolId
        ); // [ray]
        (uint256 _lockedCollateralAmount, uint256 _debtShare) = bookKeeper.positions(_collateralPoolId, _positionAddress);
        uint256 _debtAmount = rmul(rmul(_debtShare, _debtAccumulatedRate), cagePrice[_collateralPoolId]); // find the amount of debt in the unit of collateralToken
        uint256 _amount = min(_lockedCollateralAmount, _debtAmount); // if debt > lockedCollateralAmount, that's mean bad debt occur
        badDebtAccumulator[_collateralPoolId] = add(badDebtAccumulator[_collateralPoolId], sub(_debtAmount, _amount)); // accumulate bad debt in badDebtAccumulator (if there is any)

        require(_amount < 2 ** 255 && _debtShare < 2 ** 255, "ShowStopper/overflow");

        bookKeeper.confiscatePosition(
            _collateralPoolId,
            _positionAddress,
            address(this),
            address(systemDebtEngine),
            -int256(_amount),
            -int256(_debtShare)
        );
        emit LogAccumulateBadDebt(_collateralPoolId, _positionAddress, _amount, _debtShare);
    }

    /** @dev Finalize the total debt of the system after the emergency shutdown.
      This function should be called after:
      - Every positions has undergone `accumulateBadDebt` or `snip` to settle all the debt.
      - System surplus must be zero, this means all surplus should be used to settle bad debt already.
      - The emergency shutdown cooldown period must have passed.
      This total debt will be equivalent to the total stablecoin issued which should already reflect 
      the correct value if all the above requirements before calling `finalizeDebt` are satisfied.
    */
    function finalizeDebt() external {
        require(live == 0, "ShowStopper/still-live");
        require(debt == 0, "ShowStopper/debt-not-zero");
        require(bookKeeper.stablecoin(address(systemDebtEngine)) == 0, "ShowStopper/surplus-not-zero");
        require(block.timestamp >= add(cagedTimestamp, cageCoolDown), "ShowStopper/cage-cool-down-not-finished");
        debt = bookKeeper.totalStablecoinIssued();
        emit LogFinalizeDebt();
    }

    /** @dev Calculate the redeemStablecoin price of the collateral pool id.
      The redeemStablecoin price is the price where the Fathom Stablecoin owner will be entitled to cagedTimestamp redeeming from Fathom Stablecoin -> collateral token.
      The redeemStablecoin price will take into account the deficit/surplus of this collateral pool and calculate the price so that any bad debt will be covered.
    */
    function finalizeCashPrice(bytes32 _collateralPoolId) external {
        require(debt != 0, "ShowStopper/debt-zero");
        require(finalCashPrice[_collateralPoolId] == 0, "ShowStopper/final-cash-price-collateral-pool-id-already-defined");

        uint256 poolStablecoinIssued = IBookKeeper(bookKeeper).poolStablecoinIssued(_collateralPoolId);
        uint256 _debtAccumulatedRate = ICollateralPoolConfig(IBookKeeper(bookKeeper).collateralPoolConfig()).getDebtAccumulatedRate(
            _collateralPoolId
        ); // [ray]
        uint256 _wad = rmul(rmul(totalDebtShare[_collateralPoolId], _debtAccumulatedRate), cagePrice[_collateralPoolId]);
        finalCashPrice[_collateralPoolId] = mul(sub(_wad, badDebtAccumulator[_collateralPoolId]), RAY) / (poolStablecoinIssued / RAY);
        emit LogFinalizeCashPrice(_collateralPoolId);
    }

    /// @dev Accumulate the deposited stablecoin of the caller into a stablecoinAccumulator to be redeemed into collateral token later
    function accumulateStablecoin(uint256 _amount) external {
        require(_amount != 0, "ShowStopper/amount-zero");
        require(debt != 0, "ShowStopper/debt-zero");
        bookKeeper.moveStablecoin(msg.sender, address(systemDebtEngine), mul(_amount, RAY));
        stablecoinAccumulator[msg.sender] = add(stablecoinAccumulator[msg.sender], _amount);
        emit LogAccumulateStablecoin(msg.sender, _amount);
    }

    /// @dev Redeem all the stablecoin in the stablecoinAccumulator of the caller into the corresponding collateral token
    function redeemStablecoin(bytes32 _collateralPoolId, uint256 _amount) external {
        require(_amount != 0, "ShowStopper/amount-zero");
        require(finalCashPrice[_collateralPoolId] != 0, "ShowStopper/final-cash-price-collateral-pool-id-not-defined");
        bookKeeper.moveCollateral(_collateralPoolId, address(this), msg.sender, rmul(_amount, finalCashPrice[_collateralPoolId]));
        redeemedStablecoinAmount[_collateralPoolId][msg.sender] = add(redeemedStablecoinAmount[_collateralPoolId][msg.sender], _amount);
        require(
            redeemedStablecoinAmount[_collateralPoolId][msg.sender] <= stablecoinAccumulator[msg.sender],
            "ShowStopper/insufficient-stablecoin-accumulator-balance"
        );
        emit LogRedeemStablecoin(_collateralPoolId, msg.sender, _amount);
    }

    /** @dev Redeem locked collateral from the position which has been safely settled by the emergency shutdown and give the collateral back to the position owner.
      The position to be freed must has no debt at all. That means it must have gone through the process of `accumulateBadDebt` or `smip` already.
      The position will be limited to the caller address. If the position address is not an EOA address but is managed by a position manager contract,
      the owner of the position will have to move the collateral inside the position to the owner address first before calling `redeemLockedCollateral`.
    */
    function redeemLockedCollateral(
        bytes32 _collateralPoolId,
        IGenericTokenAdapter _adapter,
        address _positionAddress,
        address _collateralReceiver,
        bytes calldata _data
    ) external override {
        require(live == 0, "ShowStopper/still-live");
        require(_positionAddress == msg.sender || bookKeeper.positionWhitelist(_positionAddress, msg.sender) == 1, "ShowStopper/not-allowed");
        (uint256 _lockedCollateralAmount, uint256 _debtShare) = bookKeeper.positions(_collateralPoolId, _positionAddress);
        require(_debtShare == 0, "ShowStopper/debtShare-not-zero");
        require(_lockedCollateralAmount < 2 ** 255, "ShowStopper/overflow");
        bookKeeper.confiscatePosition(
            _collateralPoolId,
            _positionAddress,
            _collateralReceiver,
            address(systemDebtEngine),
            -int256(_lockedCollateralAmount),
            0
        );
        _adapter.onMoveCollateral(_positionAddress, _collateralReceiver, _lockedCollateralAmount, _data);
        emit LogRedeemLockedCollateral(_collateralPoolId, _collateralReceiver, _lockedCollateralAmount);
    }
}