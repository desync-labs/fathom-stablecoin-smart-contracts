// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ITimeLock {
    function queuedTransactions(bytes32) external view returns (bool);

    function queueTransaction(address, uint256, string memory, bytes memory, uint256) external;

    function executeTransaction(address, uint256, string memory, bytes memory, uint256) external payable;

    function delay() external view returns (uint256);

    function admin() external view returns (address);
}
