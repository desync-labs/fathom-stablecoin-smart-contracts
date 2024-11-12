// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022

pragma solidity 0.8.17;

interface IVaultEvents {
    event TokenAdded(address indexed tokenAddress, address indexed addedBy, uint256 timestamp);
    event TokenRemoved(address indexed tokenAddress, address indexed removedBy, uint256 timestamp);
}
