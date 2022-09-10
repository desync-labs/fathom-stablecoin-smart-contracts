// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

interface ITimeLock {
    function queuedTransactions(bytes32) external view returns (bool);

    function queueTransaction(
        address,
        uint256,
        string memory,
        bytes memory,
        uint256
    ) external;

    function executeTransaction(
        address,
        uint256,
        string memory,
        bytes memory,
        uint256
    ) external payable;

    function delay() external view returns (uint256);

    function admin() external view returns (address);
}
