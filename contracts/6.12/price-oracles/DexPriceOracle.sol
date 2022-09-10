// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022
pragma solidity ^0.6.12;

import "@alpaca-finance/alpaca-contract/contracts/6/protocol/apis/pancakeV2/PancakeLibraryV2.sol";
import "../interfaces/IFathomOracle.sol";

contract DexPriceOracle is IFathomOracle {
    // using SafeMathUpgradeable for uint256;
    address public dexFactory;

    constructor(address _dexFactory) public {
        dexFactory = _dexFactory;
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18
    /// NOTE: (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1) external view override returns (uint256, uint256) {
        if (token0 == token1) return (1e18, uint64(now));

        (uint256 r0, uint256 r1) = PancakeLibraryV2.getReserves(dexFactory, token0, token1);
        uint256 price = r0 * (1e18) / (r1);
        return (price, uint64(now));
    }
}
