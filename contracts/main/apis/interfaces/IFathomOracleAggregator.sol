// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IFathomOracleAggregator {
    function getRoundData(
        uint80 _roundId
    ) external view returns (uint80 roundId, uint256 value, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function latestRoundData() external view returns (uint80 roundId, uint256 value, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
