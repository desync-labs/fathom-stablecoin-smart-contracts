// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./IPriceFeed.sol";

interface IDelayPriceFeed is IPriceFeed {
    struct PriceInfo {
        uint256 price;
        uint256 lastUpdate;
    }

    event LogSetTimeDelay(address indexed _caller, uint256 _second);
    
    event LogPeekPriceFailed(address indexed _caller, string _reason);

    function setTimeDelay(uint256 _second) external;

    function timeDelay() external view returns (uint256);

    function nextPrice() external view returns (uint256);

    function retrivePrice() external view returns (PriceInfo memory);
}
