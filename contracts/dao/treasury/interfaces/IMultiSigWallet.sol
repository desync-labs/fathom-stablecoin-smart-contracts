// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IMultiSigWallet {
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(uint256 indexed txIndex, address indexed owner, address indexed to, uint256 value, bytes data);
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerRemoval(address indexed owner);
    event OwnerAddition(address indexed owner);
    event RequirementChange(uint256 required);

    receive() external payable;

    function removeOwner(address owner) external;

    function addOwners(address[] calldata _owners, uint256 _newNumConfirmationsRequired) external;

    function changeRequirement(uint256 _required) external;

    function submitTransaction(address _to, uint256 _value, bytes memory _data, uint256 _expireTimestamp) external;

    function confirmTransaction(uint256 _txIndex) external;

    function executeTransaction(uint256 _txIndex) external;

    function revokeConfirmation(uint256 _txIndex) external;

    function getOwners() external returns (address[] memory);

    function getTransactionCount() external returns (uint256);

    function getTransaction(
        uint256 _txIndex
    ) external returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations, uint256 expireTimestamp);

    function isConfirmedByOwner(uint256 _txIndex, address _owner) external view returns (bool);
}
