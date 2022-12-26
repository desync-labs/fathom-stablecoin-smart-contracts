// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/ICollateralPoolConfig.sol";

/** @notice A contract which is the price oracle of the BookKeeper to keep all collateral pools updated with the latest price of the collateral.
    The price oracle is important in reflecting the current state of the market price.
*/
contract PriceOracle is PausableUpgradeable, ReentrancyGuardUpgradeable, IPriceOracle, ICagable {
    struct CollateralPool {
        IPriceFeed priceFeed; // Price Feed
        uint256 liquidationRatio; // Liquidation ratio or Collateral ratio [ray]
    }

    IBookKeeper public bookKeeper; // CDP Engine
    uint256 public override stableCoinReferencePrice; // ref per FUSD [ray] :: value of stablecoin in the reference asset (e.g. $1 per Fathom USD)

    uint256 public live;

    event LogSetPrice(
        bytes32 _poolId,
        bytes32 _rawPrice, // Raw price from price feed [wad]
        uint256 _priceWithSafetyMargin, // Price with safety margin [ray]
        uint256 _rawPriceUint // Raw price from price feed in uint256
    );

    function initialize(address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        IBookKeeper(_bookKeeper).collateralPoolConfig(); // Sanity check call
        bookKeeper = IBookKeeper(_bookKeeper);
        stableCoinReferencePrice = ONE;
        live = 1;
    }

    uint256 constant ONE = 10 ** 27;

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x);
    }

    function rdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, ONE) / _y;
    }

    event LogSetStableCoinReferencePrice(address indexed _caller, uint256 _data);

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

    function setStableCoinReferencePrice(uint256 _data) external onlyOwner {
        require(live == 1, "PriceOracle/not-live");
        stableCoinReferencePrice = _data;
        emit LogSetStableCoinReferencePrice(msg.sender, _data);
    }

    function setPrice(bytes32 _collateralPoolId) external whenNotPaused {
        IPriceFeed _priceFeed = IPriceFeed(ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).collateralPools(_collateralPoolId).priceFeed);
        uint256 _liquidationRatio = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getLiquidationRatio(_collateralPoolId);
        (bytes32 _rawPrice, bool _hasPrice) = _priceFeed.peekPrice();
        uint256 _priceWithSafetyMargin = _hasPrice ? rdiv(rdiv(mul(uint256(_rawPrice), 10 ** 9), stableCoinReferencePrice), _liquidationRatio) : 0;
        address _collateralPoolConfig = address(bookKeeper.collateralPoolConfig());
        ICollateralPoolConfig(_collateralPoolConfig).setPriceWithSafetyMargin(_collateralPoolId, _priceWithSafetyMargin);
        uint256 _rawPriceInUint = uint256(_rawPrice);
        emit LogSetPrice(_collateralPoolId, _rawPrice, _priceWithSafetyMargin, _rawPriceInUint);
    }

    function cage() external override onlyOwnerOrShowStopper {
        require(live == 1, "PriceOracle/not-live");
        live = 0;
        emit LogCage();
    }

    function uncage() external override onlyOwnerOrShowStopper {
        require(live == 0, "PriceOracle/not-caged");
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
