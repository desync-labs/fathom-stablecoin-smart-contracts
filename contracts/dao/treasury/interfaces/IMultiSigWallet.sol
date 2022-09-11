// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity ^0.8.13;

interface IMultiSigWallet {
    // events
    event Deposit(address indexed sender, uint amount, uint balance);
    event SubmitTransaction(uint indexed txIndex, address indexed owner, address indexed to, uint value, bytes data);
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);
    event OwnerRemoval(address indexed owner);
    event OwnerAddition(address indexed owner);
    event RequirementChange(uint required);

    /**
     * @dev Function to receive ETH that will be handled by the governor (disabled if executor
     *        is a third party contract)
     */
    receive() external payable;

    /**
     *  @dev Allows to remove an owner. Transaction has to be sent by wallet.
     *  @param owner Address of owner.
     */
    function removeOwner(address owner) external;

    /**
     *  @dev Allows to add a new owner. Transaction has to be sent by wallet.
     *  @param owner Address of new owner.
     */
    function addOwner(address owner) external;

    /**
     *  @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
     *  @param _required Number of required confirmations.
     */
    function changeRequirement(uint _required) external;

    /**
     * @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
     * @param _to Transaction target address.
     * @param _value Transaction ether value.
     * @param _data Transaction data payload.
     * Emits SubmitTransaction event
     */
    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) external;

    /**
     * @dev Allows multiSig owners to confirm a transaction.
     * @param _txIndex Transaction Index.
     */
    function confirmTransaction(uint _txIndex) external;

    /**
     * @dev Allows anyone to execute a confirmed transaction.
     * @param _txIndex Transaction Index.
     */
    function executeTransaction(uint _txIndex) external;

    /**
     * @dev Allows multiSig owners to revoke a confimation.
     * @param _txIndex Transaction Index.
     */
    function revokeConfirmation(uint _txIndex) external;

    /**
     * @dev Returns the owners of this contract.
     */
    function getOwners() external returns (address[] memory);

    /**
     * @dev Returns the number of transactions confirmed and unconfirmed.
     */
    function getTransactionCount() external returns (uint);

    /**
     * @dev Returns a transactions details.
     * @param _txIndex Transaction Index.
     */
    function getTransaction(uint _txIndex)
        external
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        );
}
