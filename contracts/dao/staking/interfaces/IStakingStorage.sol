// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../StakingStructs.sol";

interface IStakingStorage {
    function totalShares() external view returns (uint256);

    function totalStreamShares() external view returns (uint256);

    function totalAmountOfVoteToken() external view returns (uint256);

    function totalAmountOfStakedToken() external view returns (uint256);

    function totalPenaltyBalance() external view returns (uint256);

    function streamTotalUserPendings(uint256 streamId) external view returns (uint256);

    function weight() external view returns (Weight memory);
}
