// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../../main/apis/interfaces/IPluginInvokeOracle.sol";

contract PluginOracleMock is IPluginInvokeOracle {
    uint256 public price;

    constructor(uint256 _price){
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function showPrice() external override view returns(uint256){
        return price;
    }

    function latestTimestamp() external override view returns (uint256){
        return block.timestamp;
    }
}