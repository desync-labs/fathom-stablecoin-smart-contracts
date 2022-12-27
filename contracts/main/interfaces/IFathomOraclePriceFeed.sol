// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IPriceFeed.sol";

interface IFathomOraclePriceFeed is IPriceFeed {
    function initialize(address _fathomOracle, address _token0, address _token1, address _accessControlConfig) external; 
}
