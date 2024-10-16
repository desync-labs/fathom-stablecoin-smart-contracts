// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../apis/interfaces/IFathomSwapFactory.sol";

library FathomSwapLibrary {
    function pairFor(address factory, address _tokenA, address _tokenB) internal view returns (address) {
        address pair = IFathomSwapFactory(factory).getPair(_tokenA, _tokenB);
        require(pair != address(0), "FathomSwapLibrary: pair-not-exists");
        return pair;
    }

    function sortTokens(address _tokenA, address _tokenB) internal pure returns (address token0, address token1) {
        require(_tokenA != _tokenB, "FathomSwapLibrary: IDENTICAL_ADDRESSES");
        (token0, token1) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
        require(token0 != address(0), "FathomSwapLibrary: ZERO_ADDRESS");
    }
}
