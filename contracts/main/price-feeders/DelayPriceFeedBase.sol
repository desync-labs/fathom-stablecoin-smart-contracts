// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IDelayPriceFeed.sol";
import "../interfaces/IAccessControlConfig.sol";

abstract contract DelayPriceFeedBase is PausableUpgradeable, IDelayPriceFeed {
    PriceInfo public delayedPrice;
    PriceInfo public latestPrice;
    uint256 public lastUpdateTS;
    uint256 public timeDelay;
    uint256 public priceLife;
    bytes32 public poolId;

    IAccessControlConfig public accessControlConfig;

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

    function setAccessControlConfig(address _accessControlConfig) external onlyOwner {
        require(
            IAccessControlConfig(_accessControlConfig).hasRole(IAccessControlConfig(_accessControlConfig).OWNER_ROLE(), msg.sender),
            "DelayPriceFeed/msgsender-not-owner"
        );
        accessControlConfig = IAccessControlConfig(_accessControlConfig);
    }

    function setPriceLife(uint256 _second) external onlyOwner {
        require(_second >= timeDelay * 2 && _second >= 5 minutes && _second <= 1 days, "DelayPriceFeed/bad-price-life");
        this.peekPrice();
        priceLife = _second;
        emit LogSetPriceLife(msg.sender, _second);
    }

    function setTimeDelay(uint256 _second) external onlyOwner {
        require(_second <= priceLife / 2 && _second >= 5 minutes && _second <= 1 days, "DelayPriceFeed/bad-delay-time");
        this.peekPrice();
        timeDelay = _second;
        emit LogSetTimeDelay(msg.sender, _second);
    }

    function setPoolId(bytes32 _poolId) external onlyOwner {
        poolId = _poolId;
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external onlyOwnerOrGov {
        _pause();
    }
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external onlyOwnerOrGov {
        _unpause();
        this.peekPrice();
    }

    function peekPrice() external override returns (uint256, bool) {
        if (block.timestamp >= lastUpdateTS + timeDelay || !this.isPriceFresh()) {
            try this.retrivePrice() returns (PriceInfo memory _priceInfo) {
                
                require(_priceInfo.price > 0, "DelayPriceFeed/wrong-price");
                require(_priceInfo.lastUpdate <= block.timestamp, "DelayPriceFeed/wrong-lastUpdate");

                delayedPrice = delayedPrice.price == 0 ? _priceInfo : latestPrice;
                latestPrice = _priceInfo;
                lastUpdateTS = block.timestamp;
            } catch Error(string memory reason) {
                emit LogPeekPriceFailed(msg.sender, reason);
            }
        }
        return (delayedPrice.price, this.isPriceOk());
    }

    function readPrice() external view override returns (uint256) {
        return delayedPrice.price;
    }

    function nextPrice() external view override returns (uint256) {
        return latestPrice.price;
    }

    function isPriceOk() external view override returns (bool) {
        return this.isPriceFresh() && !paused();
    }

    function isPriceFresh() external view override returns (bool) {
        return delayedPrice.lastUpdate >= block.timestamp - priceLife;
    }

    function retrivePrice() external view virtual returns (PriceInfo memory);
}
