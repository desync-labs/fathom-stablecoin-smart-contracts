// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IPriceFeed.sol";


// SimplePriceFeed is intended to be used for unit test only
contract SimplePriceFeed is IPriceFeed {
    // IAccessControlConfig public accessControlConfig;

    uint256 public price;
    uint256 public lastUpdate;

    uint256 public priceLife;

    // --- Init ---
    constructor() public {
        priceLife = 1 days; // [seconds] how old the price is considered stale, default 1 day
    }


    event LogSetPrice(address indexed _caller, uint256 _price, uint256 indexed _lastUpdate);
    event LogSetPriceLife(address indexed _caller, uint256 _second);

    /// @dev access: OWNER_ROLE
    function setPrice(uint256 _price) external {
        price = _price;
        lastUpdate = now;
        emit LogSetPrice(msg.sender, price, lastUpdate);
    }

    /// @dev access: OWNER_ROLE
    function setPriceLife(uint256 _second) external {
        require(_second >= 1 hours && _second <= 1 days, "SimplePriceFeed/bad-price-life");
        priceLife = _second;
        emit LogSetPriceLife(msg.sender, _second);
    }

    function readPrice() external view override returns (bytes32) {
        return bytes32(price);
    }

    function peekPrice() external view override returns (bytes32, bool) {
        return (bytes32(price), _isPriceOk());
    }

    function _isPriceFresh() internal view returns (bool) {
        // solhint-disable not-rely-on-time
        return lastUpdate >= now - priceLife;
    }

    function _isPriceOk() internal view returns (bool) {
        return _isPriceFresh();
    }
}
