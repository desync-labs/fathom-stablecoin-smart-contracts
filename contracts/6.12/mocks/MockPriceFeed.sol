// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IPriceFeed.sol";

contract MockPriceFeed is IPriceFeed {
    function readPrice() external view override returns (bytes32) {
        return 0;
    }

    function peekPrice() external view override returns (bytes32, bool) {
        return (0, true);
    }
}
