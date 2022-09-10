// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IFathomOracle.sol";

contract MockFathomOracle is IFathomOracle {
    function getPrice(address, address) external view override returns (uint256 price, uint256 lastUpdate) {
        return (0, 0);
    }
}
