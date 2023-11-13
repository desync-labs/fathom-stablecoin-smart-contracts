// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFathomSwapFactory {
    event PairCreated(address indexed _token0, address indexed _token1, address _pair, uint);

    function createPair(address _tokenA, address _tokenB) external returns (address pair);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function getPair(address _tokenA, address _tokenB) external view returns (address pair);

    function allPairs(uint) external view returns (address pair);

    function allPairsLength() external view returns (uint);
}
