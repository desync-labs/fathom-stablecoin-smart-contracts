// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../../main/apis/interfaces/IPluginInvokeOracle.sol";

contract PluginOracleMock is IPluginInvokeOracle {
    uint256 public price;
    uint256 public requestId;

    constructor(uint256 _price){
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function depositPLI(uint256) external returns(bool){
        return true;
    }

    function requestData(address) external override returns (uint256){
        return ++requestId;
    }

    function showPrice(uint256) external override view returns(uint256, uint256){
        return (price, block.timestamp);
    }

    function latestAnswer() external override view returns (int256){
        return int256(price);
    }

    function latestTimestamp() external override view returns (uint256){
        return block.timestamp;
    }

    function latestRound() external override view returns (uint256){
        return requestId;
    }

    function getAnswer(uint256) external override view returns (int256){
        return int256(price);
    }
    
    function getTimestamp(uint256) external override view returns (uint256){
        return block.timestamp;
    }
}