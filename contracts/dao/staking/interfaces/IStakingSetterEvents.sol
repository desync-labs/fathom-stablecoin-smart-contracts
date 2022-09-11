// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity ^0.8.13;

interface IStakingSetterEvents {
    event MaxLockPositionsSet(uint256 indexed oldMaxLockPositions, uint256 indexed newMaxLockPositions);

    event EarlyWithdrawalFlagSet(bool indexed oldFlag, bool indexed newFlag);

    event TreasuryAddressSet(address indexed oldTreasuryAddress, address indexed newTreasuryAddress);
}
