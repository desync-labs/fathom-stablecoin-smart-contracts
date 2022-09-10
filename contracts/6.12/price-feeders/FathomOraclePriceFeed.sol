// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022


pragma solidity 0.6.12;


import "../interfaces/IPriceFeed.sol";
import "../interfaces/IFathomOracle.sol";

contract FathomOraclePriceFeed is IPriceFeed {
    IFathomOracle public fathomOracle;
    address public token0;
    address public token1;
    uint256 public priceLife; // [seconds] how old the price is considered stale, default 1 day

    // --- Init ---
    constructor(
        address _fathomOracle,
        address _token0, //the token that will be the currency to show token1's price
        address _token1 //collateral token.
    ) public {
        
        fathomOracle = IFathomOracle(_fathomOracle);
        require(_token0 != _token1, "FathomOraclePriceFeed/wrong-token0-token1");
        token0 = _token0;
        token1 = _token1;
        priceLife = 1 days;
    }

    event LogSetPriceLife(address indexed _caller, uint256 _second);

    /// @dev access: OWNER_ROLE
    function setPriceLife(uint256 _second) external {
        require(_second >= 1 hours && _second <= 1 days, "FathomOraclePriceFeed/bad-price-life");
        priceLife = _second;
        emit LogSetPriceLife(msg.sender, _second);
    }

    function readPrice() external view override returns (bytes32) {
        (uint256 _price, ) = fathomOracle.getPrice(token0, token1);
        return bytes32(_price);
    }

    function peekPrice() external view override returns (bytes32, bool) {
        // [wad], [seconds]
        (uint256 _price, uint256 _lastUpdate) = fathomOracle.getPrice(token0, token1);
        return (bytes32(_price), _isPriceOk(_lastUpdate));
    }

    function _isPriceFresh(uint256 _lastUpdate) internal view returns (bool) {
        // solhint-disable not-rely-on-time
        return _lastUpdate >= now - priceLife;
    }

    function _isPriceOk(uint256 _lastUpdate) internal view returns (bool) {
        return _isPriceFresh(_lastUpdate);
    }
}
