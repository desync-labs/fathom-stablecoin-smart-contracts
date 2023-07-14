// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IFathomOracle.sol";
import "../interfaces/IAccessControlConfig.sol";
import "./DelayPriceFeedBase.sol";

contract DelayFathomOraclePriceFeed is DelayPriceFeedBase {
    address public token0;
    address public token1;
    IFathomOracle public fathomOracle;

    function initialize(address _fathomOracle, address _token0, address _token1, address _accessControlConfig, bytes32 _poolId) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(_accessControlConfig != address(0), "DelayFathomOraclePriceFeed/zero-access-control");
        accessControlConfig = IAccessControlConfig(_accessControlConfig);

        fathomOracle = IFathomOracle(_fathomOracle);
        require(_token0 != _token1, "DelayFathomOraclePriceFeed/same-token0-token1");
        require(_token0 != address(0) && _token1 != address(0), "DelayFathomOraclePriceFeed/zero-token");
        token0 = _token0;
        token1 = _token1;
        priceLife = 30 minutes;
        timeDelay = 15 minutes;
        poolId = _poolId;
    }

    function setToken0(address _token) external onlyOwner {
        require(_token != address(0), "DelayFathomOraclePriceFeed/zero-token");
        require(token1 != _token, "DelayFathomOraclePriceFeed/same-token0-token1");

        token0 = _token;
    }

    function setToken1(address _token) external onlyOwner {
        require(_token != address(0), "DelayFathomOraclePriceFeed/zero-token");
        require(token0 != _token, "DelayFathomOraclePriceFeed/same-token0-token1");

        token1 = _token;
    }

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "DelayFathomOraclePriceFeed/zero-access-control-config");
        fathomOracle = IFathomOracle(_oracle);
        this.peekPrice();
    }

    function retrivePrice() external view override returns (PriceInfo memory) {
        (uint256 _price, uint256 _lastUpdate) = IFathomOracle(fathomOracle).getPrice(token0, token1);
        return PriceInfo(_price, _lastUpdate);
    }
}
