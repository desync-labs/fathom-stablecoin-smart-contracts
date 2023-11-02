// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../../main/interfaces/IPriceFeed.sol";
import "../../main/interfaces/IFathomOracle.sol";
import "../../main/interfaces/IAccessControlConfig.sol";

contract ParanoidDexOraclePriceFeed is PausableUpgradeable, IPriceFeed {
    struct VerifiablePrice {
        uint256 price;
        bool isVerified;
    }

    VerifiablePrice public latestPrice;
    VerifiablePrice public delayedPrice;
    uint256 public lastUpdateTS;
    uint256 public timeDelay;
    uint256 public priceLife;
    bytes32 public poolId;
    uint256 public tolleranceBps; // % = tollerance/10000 (500/10000 = 0.05 = 5%)

    IFathomOracle public fathomOracle;
    IAccessControlConfig public accessControlConfig;
    address public token0;
    address public token1;
    address[] public verificationFeeds;

    event LogSetTimeDelay(address indexed _caller, uint256 _second);

    modifier onlyOwner() {
        require(accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        require(
            accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender) ||
                accessControlConfig.hasRole(accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    function initialize(
        address _fathomOracle,
        address[] calldata _verificationFeeds,
        address _token0,
        address _token1,
        address _accessControlConfig,
        bytes32 _poolId
    ) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(_accessControlConfig != address(0), "FathomOraclePriceFeed: ZERO_ADDRESS");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);

        fathomOracle = IFathomOracle(_fathomOracle);

        require(_token0 != _token1, "FathomOraclePriceFeed/same-token0-token1");
        require(_token0 != address(0) && _token1 != address(0), "FathomOraclePriceFeed: ZERO_ADDRESS");
        token0 = _token0;
        token1 = _token1;
        priceLife = 30 minutes;
        timeDelay = 15 minutes;
        poolId = _poolId;

        require(_verificationFeeds.length > 0, "ParanoidOraclePriceFeed/empty-verification-feeds");
        for (uint256 i = 0; i < _verificationFeeds.length; i++) {
            require(IPriceFeed(_verificationFeeds[0]).isPriceOk(), "ParanoidOraclePriceFeed/feed-is-not-healthy");
        }
        verificationFeeds = _verificationFeeds;
    }

    function peekPrice() external override returns (uint256, bool) {
        return _peekPrice();
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "FathomOraclePriceFeed/msgsender-not-owner"
        );
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }

    function addVerificationFeed(address _priceFeed) external onlyOwner {
        require(IPriceFeed(_priceFeed).isPriceOk(), "ParanoidOraclePriceFeed/feed-is-not-healthy");
        verificationFeeds.push(_priceFeed);
    }

    function removeVerificationFeed(uint _index) external onlyOwner {
        require(verificationFeeds.length > 1, "ParanoidOraclePriceFeed/cant-remove-last-verification-feed");
        require(_index < verificationFeeds.length, "ParanoidOraclePriceFeed/wrong-index");
        verificationFeeds[_index] = verificationFeeds[verificationFeeds.length - 1];
        verificationFeeds.pop();
    }

    function setPriceLife(uint256 _second) external onlyOwner {
        require(_second >= timeDelay && _second >= 5 minutes && _second <= 1 days, "FathomOraclePriceFeed/bad-price-life");
        priceLife = _second;
        emit LogSetPriceLife(msg.sender, _second);
    }

    function setTimeDelay(uint256 _second) external onlyOwner {
        require(_second <= priceLife && _second >= 5 minutes && _second <= 1 days, "FathomOraclePriceFeed/bad-delay-time");
        _peekPrice();
        timeDelay = _second;
        emit LogSetTimeDelay(msg.sender, _second);
    }

    function setTollerance(uint256 _tolleranceBps) external onlyOwner {
        require(_tolleranceBps >= 10 && _tolleranceBps <= 1000, "ParanoidOraclePriceFeed/invalid-tollerance"); // should be between 0.1% and 10%
        tolleranceBps = _tolleranceBps;
    }

    function setToken0(address _token) external onlyOwner {
        require(_token != address(0), "FathomOraclePriceFeed: ZERO_ADDRESS");
        require(token1 != _token, "FathomOraclePriceFeed/same-token0-token1");

        token0 = _token;
    }

    function setToken1(address _token) external onlyOwner {
        require(_token != address(0), "FathomOraclePriceFeed: ZERO_ADDRESS");
        require(token0 != _token, "FathomOraclePriceFeed/same-token0-token1");

        token1 = _token;
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "FathomOraclePriceFeed: ZERO_ADDRESS");
        fathomOracle = IFathomOracle(_oracle);
    }

    function setPoolId(bytes32 _poolId) external onlyOwner {
        poolId = _poolId;
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        _peekPrice();
    }

    function setPrice() external onlyOwner {
        _setPrice();
    }

    function readPrice() external view returns (uint256) {
        return delayedPrice.price;
    }

    function isPriceOk() external view override returns (bool) {
        return _isPriceOk();
    }

    function _peekPrice() internal returns (uint256, bool) {
        if (block.timestamp >= lastUpdateTS + timeDelay) {
            _setPrice();
        }
        return (delayedPrice.price, _isPriceOk());
    }

    function _setPrice() internal {
        (uint256 _price, uint256 _lastUpdate) = fathomOracle.getPrice(token0, token1);

        require(_price > 0, "FathomOraclePriceFeed/wrong-price");
        require(_lastUpdate <= block.timestamp, "FathomOraclePriceFeed/wrong-lastUpdate");

        VerifiablePrice memory freshPrice = VerifiablePrice(_price, _verifyPrice(_price));

        delayedPrice = delayedPrice.price == 0 ? freshPrice : latestPrice;
        latestPrice = freshPrice;
        lastUpdateTS = _lastUpdate;
    }

    function _verifyPrice(uint _price) internal returns (bool isVerified) {
        for (uint256 i = 0; i < verificationFeeds.length; i++) {
            (uint256 priceToCompare, bool isOk) = IPriceFeed(verificationFeeds[i]).peekPrice();
            isVerified = isOk && _arePricesSimilar(_price, priceToCompare);
            if (!isVerified) {
                break;
            }
        }
    }

    function _arePricesSimilar(uint256 _price0, uint256 _price1) internal view returns (bool) {
        if (_price0 == _price1) {
            return true;
        }
        uint256 tolerance = (_price0 * tolleranceBps) / 10000;
        uint256 diff = _price0 > _price1 ? _price0 - _price1 : _price1 - _price0;
        return diff <= tolerance;
    }

    function _isPriceFresh() internal view returns (bool) {
        return lastUpdateTS >= block.timestamp - priceLife;
    }

    function _isPriceOk() internal view returns (bool) {
        return delayedPrice.isVerified && _isPriceFresh() && !paused();
    }

    function isPriceFresh() external view returns (bool) {}
}
