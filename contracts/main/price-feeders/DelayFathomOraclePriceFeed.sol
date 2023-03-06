// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IFathomOraclePriceFeed.sol";
import "../interfaces/IFathomOracle.sol";
import "../interfaces/IAccessControlConfig.sol";

contract DelayFathomOraclePriceFeed is PausableUpgradeable, IFathomOraclePriceFeed {
    uint256 public latestPrice;
    uint256 public delayedPrice;
    uint256 public lastUpdateTS;
    uint256 public timeDelay;
    uint256 public priceLife;

    IFathomOracle public fathomOracle;
    IAccessControlConfig public accessControlConfig;
    address public token0;
    address public token1;

    function initialize(address _fathomOracle, address _token0, address _token1, address _accessControlConfig) external initializer {
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
    }

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

    event LogSetPriceLife(address indexed _caller, uint256 _second);
    event LogSetTimeDelay(address indexed _caller, uint256 _second);

    function readPrice() external view override returns (bytes32) {
        return bytes32(delayedPrice);
    }

    function peekPrice() external override returns (bytes32, bool) {
       return _peekPrice();
    }

    function isPriceOk() external view override returns (bool) {
        return _isPriceOk();
    }

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender), "FathomOraclePriceFeed/msgsender-not-owner");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }

    function setPriceLife(uint256 _second) external onlyOwner {
        require(_second >= timeDelay && _second >= 5 minutes && _second <= 1 days, "FathomOraclePriceFeed/bad-price-life");
        priceLife = _second;
        emit LogSetPriceLife(msg.sender, _second);
    }

    function setTimeDelay(uint256 _second) external onlyOwner {
        require(_second <= priceLife &&_second >= 5 minutes && _second <= 1 days, "FathomOraclePriceFeed/bad-delay-time");
        _peekPrice();
        timeDelay = _second;
        emit LogSetTimeDelay(msg.sender, _second);
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

    function _peekPrice() internal returns (bytes32, bool) {
        if (block.timestamp >= lastUpdateTS + timeDelay) {
          _setPrice();
        }
        return (bytes32(delayedPrice), _isPriceOk());
    }

    function _setPrice() internal {
        (uint256 _price, uint256 _lastUpdate) = fathomOracle.getPrice(token0, token1);
        
        require(_price > 0, "FathomOraclePriceFeed/wrong-price");
        require(_lastUpdate <= block.timestamp, "FathomOraclePriceFeed/wrong-lastUpdate");

        delayedPrice = delayedPrice == 0 ? _price : latestPrice;
        latestPrice = _price;
        lastUpdateTS = _lastUpdate;
    }

    function _isPriceFresh() internal view returns (bool) {
        return lastUpdateTS >= block.timestamp - priceLife;
    }

    function _isPriceOk() internal view returns (bool) {
        return _isPriceFresh() && !paused();
    }
}
