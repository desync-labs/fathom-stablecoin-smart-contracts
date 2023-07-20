// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./lib/FathomSwapLibrary.sol";
import "../apis/interfaces/IFathomSwapPair.sol";
import "../interfaces/IFathomDEXOracle.sol";
import "../interfaces/IToken.sol";

contract DexPriceOracle is Initializable, IFathomDEXOracle {
    address public dexFactory;

    function initialize(address _dexFactory) external initializer {
        require(_dexFactory != address(0), "DexPriceOracle/zero-factory");

        dexFactory = _dexFactory;
    }

    /// @dev Return the wad price of token0/token1, multiplied by 1e18 (if you have 1 token0 how much you can sell it for token1)
    function getPrice(address token0, address token1) external view override returns (uint256, uint256) {
        require(token0 != token1, "DexPriceOracle/same-tokens");

        address pair = FathomSwapLibrary.pairFor(dexFactory, token0, token1);
        (address tokenA, ) = FathomSwapLibrary.sortTokens(token0, token1);

        uint256 r0;
        uint256 r1;

        if (token0 == tokenA) {
            (r0, r1, ) = IFathomSwapPair(pair).getReserves();
        } else {
            (r1, r0, ) = IFathomSwapPair(pair).getReserves();
        }

        uint256 decimals0 = IToken(token0).decimals();
        uint256 decimals1 = IToken(token1).decimals();

        (uint256 normalized0, uint256 normalized1) = decimals0 >= decimals1
            ? (r0, r1 * (10 ** (decimals0 - decimals1)))
            : (r0 * (10 ** (decimals1 - decimals0)), r1);

        uint price = (normalized1 * 1e18) / normalized0;
        return (price, block.timestamp);
    }
}
