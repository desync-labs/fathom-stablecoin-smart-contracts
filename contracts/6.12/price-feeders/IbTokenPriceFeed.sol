// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IFathomOracle.sol";


contract CollateralTokenPriceFeed is IPriceFeed {
    IPriceFeed public ibInBasePriceFeed;
    IPriceFeed public baseInUsdPriceFeed;

    uint256 public timeDelay; // in seconds
    uint256 public lastUpdateTimestamp; // block timestamp

    struct Feed {
        uint128 val;
        uint128 ok;
    }

    Feed private currentPrice;
    Feed private nextPrice;

    event LogValue(bytes32 val);
    event LogSetTimeDelay(address indexed caller, uint256 newTimeDelay);
    event SetIbInBasePriceFeed(address indexed caller, address newIbInBasePriceFeed);
    event SetBaseInUsdPriceFeed(address indexed caller, address newBaseInUserPriceFeed);

    // --- Init ---
    constructor(
        address _ibInBasePriceFeed,
        address _baseInUsdPriceFeed,
        uint256 _timeDelay
    ) public {
        ibInBasePriceFeed = IPriceFeed(_ibInBasePriceFeed);
        baseInUsdPriceFeed = IPriceFeed(_baseInUsdPriceFeed);

        ibInBasePriceFeed.peekPrice();
        baseInUsdPriceFeed.peekPrice();

        require(_timeDelay >= 15 minutes && _timeDelay <= 2 days, "IbTokenPriceFeed/time-delay-out-of-bound");
        timeDelay = _timeDelay;
    }

    // --- Math ---
    function add(uint64 x, uint64 y) internal pure returns (uint64 z) {
        z = x + y;
        require(z >= x);
    }
    
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function setTimeDelay(uint256 _newTimeDelay) external {
        require(_newTimeDelay >= 15 minutes && _newTimeDelay <= 2 days, "IbTokenPriceFeed/time-delay-out-of-bound");
        timeDelay = _newTimeDelay;
        emit LogSetTimeDelay(msg.sender, _newTimeDelay);
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function setIbInBasePriceFeed(IPriceFeed _newIbInBasePriceFeed) external {
        ibInBasePriceFeed = _newIbInBasePriceFeed;
        IPriceFeed(ibInBasePriceFeed).peekPrice();
        emit SetIbInBasePriceFeed(msg.sender, address(_newIbInBasePriceFeed));
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function setBaseInUsdPriceFeed(IPriceFeed _newBaseInUsdPriceFeed) external {
        baseInUsdPriceFeed = _newBaseInUsdPriceFeed;
        IPriceFeed(baseInUsdPriceFeed).peekPrice();
        emit SetBaseInUsdPriceFeed(msg.sender, address(_newBaseInUsdPriceFeed));
    }

    function readPrice() external view override returns (bytes32) {
        return (bytes32(uint256(currentPrice.val)));
    }

    function peekPrice() external view override returns (bytes32, bool) {
        return (bytes32(uint256(currentPrice.val)), currentPrice.ok == 1);
    }

    function peekNextPrice() external view returns (bytes32, bool) {
        return (bytes32(uint256(nextPrice.val)), nextPrice.ok == 1);
    }

    function setPrice() public {
        require(pass(), "IbTokenPriceFeed/time-delay-has-not-passed");
        (bytes32 ibInBasePrice, bool ibInBasePriceOk) = ibInBasePriceFeed.peekPrice();
        (bytes32 baseInUsdPrice, bool baseInUsdPriceOk) = baseInUsdPriceFeed.peekPrice();

        uint256 price = uint256(ibInBasePrice) * (uint256(baseInUsdPrice)) / (1e18);
        bool ok = ibInBasePriceOk && baseInUsdPriceOk;

        require(ok, "IbTokenPriceFeed/not-ok");
        currentPrice = nextPrice;
        nextPrice = Feed(uint128(price), 1);
        lastUpdateTimestamp = getStartOfIntervalTimestamp(block.timestamp);
        emit LogValue(bytes32(uint256(currentPrice.val)));
    }

    function getStartOfIntervalTimestamp(uint256 ts) internal view returns (uint256) {
        require(timeDelay != 0, "IbTokenPriceFeed/time-delay-is-zero");
        return ts - (ts % (timeDelay));
    }

    function pass() public view returns (bool ok) {
        return block.timestamp >= lastUpdateTimestamp + (timeDelay);
    }
}
