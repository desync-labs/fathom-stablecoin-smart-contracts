// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IFathomOracle.sol";
import "../interfaces/IStdReference.sol";


contract BandPriceOracle is IFathomOracle {
    IStdReference public stdReferenceProxy;
    // map between token address and its symbol
    // note that, we're going to treat "USD" as address "0xfff...fff"
    mapping(address => string) public tokenSymbols;

    struct PriceData {
        uint192 price;
        uint64 lastUpdate;
    }

    constructor(address _stdReferenceProxy, address _accessControlConfig) public {
        stdReferenceProxy = IStdReference(_stdReferenceProxy);
        stdReferenceProxy.getReferenceData("BUSD", "USD");
    }

    event LogSetTokenSymbol(address indexed _tokenAddress, string _tokenSymbol);

    /// @dev access: OWNER_ROLE
    function setTokenSymbol(address _tokenAddress, string memory _tokenSymbol) external {
        tokenSymbols[_tokenAddress] = _tokenSymbol;
        emit LogSetTokenSymbol(_tokenAddress, _tokenSymbol);
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address _token0, address _token1) external view override returns (uint256, uint256) {
        string memory symbol0 = tokenSymbols[_token0];
        string memory symbol1 = tokenSymbols[_token1];

        require(keccak256(bytes(symbol0)) != keccak256(bytes(symbol1)), "BandPriceOracle/same-symbol");
        require(keccak256(bytes(symbol0)) != keccak256(bytes("")), "BandPriceOracle/unknown-token0");
        require(keccak256(bytes(symbol1)) != keccak256(bytes("")), "BandPriceOracle/unknown-token1");

        IStdReference.ReferenceData memory priceData = stdReferenceProxy.getReferenceData(symbol0, symbol1);

        // find min lasteUpdate
        uint256 lastUpdate = priceData.lastUpdatedBase < priceData.lastUpdatedQuote
            ? priceData.lastUpdatedBase
            : priceData.lastUpdatedQuote;

        return (priceData.rate, lastUpdate);
    }
}
