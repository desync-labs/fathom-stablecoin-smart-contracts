// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity ^0.8.13;

interface IStakingSetter {
    function setMaxLockPositions(uint8 _maxLockPositions) external;

    function setEarlyWithdrawalFlag(bool _flag) external;

    function setTreasuryAddress(address _treasury) external;

    function setGovernanceContract(
        address _govnContract
    ) external;
}
