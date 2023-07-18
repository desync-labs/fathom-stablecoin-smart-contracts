// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/ICagable.sol";
import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IPausable.sol";
import "../interfaces/ISetPrice.sol";
import "../utils/CommonMath.sol";

/** @notice A contract which is the price oracle of the BookKeeper to keep all collateral pools updated with the latest price of the collateral.
    The price oracle is important in reflecting the current state of the market price.
*/
contract PriceOracle is CommonMath, PausableUpgradeable, IPriceOracle, ICagable, IPausable, ISetPrice {
    struct CollateralPool {
        IPriceFeed priceFeed; // Price Feed
        uint256 liquidationRatio; // Liquidation ratio or Collateral ratio [ray]
    }

    uint256 internal constant MIN_REFERENCE_PRICE = 10 ** 24;
    uint256 internal constant MAX_REFERENCE_PRICE = 2 * (10 ** 27);

    IBookKeeper public bookKeeper; // CDP Engine
    uint256 public override stableCoinReferencePrice; // ref per FUSD [ray] :: value of stablecoin in the reference asset (e.g. $1 per Fathom USD)

    uint256 public live;

    event LogSetPrice(
        bytes32 indexed _poolId,
        uint256 _rawPrice, // Raw price from price feed [wad]
        uint256 _priceWithSafetyMargin // Price with safety margin [ray]
    );

    event LogSetStableCoinReferencePrice(address indexed _caller, uint256 _data);

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

    modifier isLive() {
        require(live == 1, "PriceOracle/not-live");
        _;
    }

    function initialize(address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();
        require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "FixedSpreadLiquidationStrategy/invalid-bookKeeper"); // Sanity Check Call
        bookKeeper = IBookKeeper(_bookKeeper);
        stableCoinReferencePrice = RAY;
        live = 1;
    }

    function setBookKeeper(address _bookKeeper) external onlyOwner isLive {
        require(IBookKeeper(_bookKeeper).totalStablecoinIssued() >= 0, "ShowStopper/invalid-bookKeeper"); // Sanity Check Call
        bookKeeper = IBookKeeper(_bookKeeper);
    }

    function setStableCoinReferencePrice(uint256 _referencePrice) external onlyOwner isLive {
        require(_referencePrice > MIN_REFERENCE_PRICE && _referencePrice < MAX_REFERENCE_PRICE, "PriceOracle/invalid-reference-price");
        stableCoinReferencePrice = _referencePrice;
        emit LogSetStableCoinReferencePrice(msg.sender, _referencePrice);
    }

    function setPrice(bytes32 _collateralPoolId) external override whenNotPaused isLive {
        IPriceFeed _priceFeed = IPriceFeed(ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).collateralPools(_collateralPoolId).priceFeed);
        uint256 _liquidationRatio = ICollateralPoolConfig(bookKeeper.collateralPoolConfig()).getLiquidationRatio(_collateralPoolId);
        (uint256 _rawPrice, bool _hasPrice) = _priceFeed.peekPrice();
        uint256 _priceWithSafetyMargin = _hasPrice ? rdiv(rdiv(_rawPrice * (10 ** 9), stableCoinReferencePrice), _liquidationRatio) : 0;
        address _collateralPoolConfig = address(bookKeeper.collateralPoolConfig());
        ICollateralPoolConfig(_collateralPoolConfig).setPriceWithSafetyMargin(_collateralPoolId, _priceWithSafetyMargin);
        emit LogSetPrice(_collateralPoolId, _rawPrice, _priceWithSafetyMargin);
    }

    function cage() external override onlyOwnerOrShowStopper {
        if (live == 1) {
            live = 0;
            emit LogCage();
        }
    }

    function uncage() external override onlyOwnerOrShowStopper {
        require(live == 0, "PriceOracle/not-caged");
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
