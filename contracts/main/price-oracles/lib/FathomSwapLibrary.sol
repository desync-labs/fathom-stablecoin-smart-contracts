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
 
        (bool success, bytes memory data1) = factory.staticcall(abi.encodeWithSignature("getPair(address,address)", tokenA, tokenB));


        bytes memory empty;
        //a) check if factory was wrong
        //if data1 returns empty bytes array, that means factory address had no factory getPair getter fn
        require(keccak256(data1) != keccak256(empty), "wrong factory address");
        //b) check if pair address is address(0) or not.
        //even if factory address was correct, the pair may not exist
        //revert if it is address(0)
        require(keccak256(data1) != keccak256(abi.encode(0)), "pair nonexistent");

        //c) pair needs to be converted to address
        //bytes memory to address
        //bytes memory data1 -> address...hm...
        address pair;
        assembly {
            pair := data1
        }

        (bool success, bytes memory data) = pair.staticcall(abi.encodeWithSignature("getReserves()"));
        require(data.length == 0x60, "invalid data length")
        require(success, "getReserves call failed");

        //d) data length check
        uint256 reserve0;
        uint256 reserve1;
        assembly {
            let fmp := mload(0x40)
            mstore(fmp, data)
            if iszero(data == 0x0) {
                revert
            }
            reserve1 := mload(sub(fmp, 0x40))
            reserve0 := mload(sub(fmp, 0x60))
        }
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return (reserveA, reserveB);
    }
}
