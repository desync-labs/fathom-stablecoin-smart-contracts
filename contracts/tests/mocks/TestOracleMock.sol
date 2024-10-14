// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { ITestOracleOracle } from "../../main/apis/interfaces/ITestOracleOracle.sol";

contract TestOracleMock is ITestOracleOracle {
    uint256 public price;
    uint256 public requestId;

    constructor(uint256 _price) {
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function requestData(address) external override returns (uint256) {
        return ++requestId;
    }

    function showPrice(uint256) external view override returns (uint256, uint256) {
        return (price, block.timestamp);
    }

    function latestAnswer() external view override returns (int256) {
        return int256(price);
    }

    function latestTimestamp() external view override returns (uint256) {
        return block.timestamp;
    }

    function latestRound() external view override returns (uint256) {
        return requestId;
    }

    function getAnswer(uint256) external view override returns (int256) {
        return int256(price);
    }

    function getTimestamp(uint256) external view override returns (uint256) {
        return block.timestamp;
    }

    function depositPLI(uint256) external pure returns (bool) {
        return true;
    }
}
