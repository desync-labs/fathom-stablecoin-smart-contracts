// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IFathomSwapPair.sol";
import "./IFathomSwapFactory.sol";

library FathomSwapLibrary {
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "FathomSwapLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "FathomSwapLibrary: ZERO_ADDRESS");
    }

    function pairFor(address factory, address tokenA, address tokenB) internal view returns (address pair) {
        return IFathomSwapFactory(factory).getPair(tokenA, tokenB); // For easy testing
    }

    function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        address pair = pairFor(factory, tokenA, tokenB);
        (bool success, bytes memory data) = pair.staticcall(abi.encodeWithSignature("getReserves()"));
        require(success, "getReserves call failed");
        uint256 reserve0;
        uint256 reserve1;
        assembly {
            let fmp := mload(0x40)
            mstore(fmp, data)
            reserve1 := mload(sub(fmp, 0x40))
            reserve0 := mload(sub(fmp, 0x60))
        }
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return (reserveA, reserveB);
    }
}
