// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../apis/interfaces/IFathomSwapFactory.sol";

library FathomSwapLibrary {
    function pairFor(address factory, address tokenA, address tokenB) internal view returns (address) {
        address pair = IFathomSwapFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "FathomSwapLibrary: pair-not-exists");
        return pair;
    }

    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "FathomSwapLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "FathomSwapLibrary: ZERO_ADDRESS");
    }
}
