// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPluginInvokeOracle {
    function requestData(address _caller) external returns (uint256);
    function depositPLI(uint256 _value) external returns(bool);
    function showPrice(uint256 _reqid) external view returns (uint256, uint256);
    function latestAnswer() external view returns (int256);
    function latestTimestamp() external view returns (uint256);
    function latestRound() external view returns (uint256);
    function getAnswer(uint256 roundId) external view returns (int256);
    function getTimestamp(uint256 roundId) external view returns (uint256);
}
