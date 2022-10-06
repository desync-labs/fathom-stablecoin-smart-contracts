// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity ^0.8.13;

import "../../common/libraries/BytesHelper.sol";
import "./interfaces/IMultiSigWallet.sol";

contract MultiSigWallet is IMultiSigWallet {
    using BytesHelper for *;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    /*
     *  Constants
     */
    uint public constant MAX_OWNER_COUNT = 50;

    address[] public owners;
    address public governor;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;

    // mapping from tx index => owner => bool
    mapping(uint => mapping(address => bool)) public isConfirmed;

    // an array of transactions
    Transaction[] public transactions;

    /*
     *  Modifiers
     */
    modifier onlyOwnerOrGov() {
        require(
            isOwner[msg.sender] || governor == msg.sender,
            "MultiSig: MultiSigWallet, onlyOwnerOrGov(): Neither owner nor governor"
        );
        _;
    }

    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "MultiSig: tx does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "MultiSig: tx already executed");
        _;
    }

    modifier notConfirmed(uint _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "MultiSig: tx already confirmed");
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(!isOwner[owner], "MultiSig:  Owner already exists");
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this), "MultiSig:  Only this wallet can use this funciton");
        _;
    }

    modifier notNull(address _address) {
        require(_address != address(0), "MultiSig: _address == 0");
        _;
    }

    modifier validRequirement(uint ownerCount, uint _required) {
        require(
            ownerCount <= MAX_OWNER_COUNT && _required <= ownerCount && _required != 0 && ownerCount != 0,
            "MultiSig: Invalid requirement"
        );
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner], "MultiSig: !isOwner[owner]");
        _;
    }

    constructor(
        address[] memory _owners,
        uint _numConfirmationsRequired,
        address _governor
    ) {
        governor = _governor;
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 && _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /**
     * @dev Function to receive ETH that will be handled by the governor (disabled if executor
     *        is a third party contract)
     */
    receive() external payable override {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     *  @dev Allows to remove an owner. Transaction has to be sent by wallet.
     *  @param owner Address of owner.
     */
    function removeOwner(address owner) public override onlyWallet ownerExists(owner) {
        isOwner[owner] = false;
        for (uint i = 0; i < owners.length - 1; i++)
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        owners.pop();
        if (numConfirmationsRequired > owners.length) changeRequirement(owners.length);
        emit OwnerRemoval(owner);
    }

    /**
     *  @dev Allows to add a new owner. Transaction has to be sent by wallet.
     *  @param owner Address of new owner.
     */
    function addOwner(address owner)
        public
        override
        onlyWallet
        ownerDoesNotExist(owner)
        notNull(owner)
        validRequirement(owners.length + 1, numConfirmationsRequired)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    /**
     *  @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
     *  @param _required Number of required confirmations.
     */
    function changeRequirement(uint _required) public override onlyWallet validRequirement(owners.length, _required) {
        numConfirmationsRequired = _required;
        emit RequirementChange(_required);
    }

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
    ) public override onlyOwnerOrGov {
        uint txIndex = transactions.length;

        transactions.push(Transaction({ to: _to, value: _value, data: _data, executed: false, numConfirmations: 0 }));

        emit SubmitTransaction(txIndex, msg.sender, _to, _value, _data);
    }

    /**
     * @dev Allows multiSig owners to confirm a transaction.
     * @param _txIndex Transaction Index.
     */
    function confirmTransaction(uint _txIndex)
        public
        override
        onlyOwnerOrGov
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Allows anyone to execute a confirmed transaction.
     * @param _txIndex Transaction Index.
     * Emits event: ExecuteTransaction
     */
    function executeTransaction(uint _txIndex) public override onlyOwnerOrGov txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(transaction.numConfirmations >= numConfirmationsRequired, "cannot execute tx");

        transaction.executed = true;

        (bool success, ) = transaction.to.call{ value: transaction.value }(transaction.data);
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Allows multiSig owners to revoke a confimation.
     * @param _txIndex Transaction Index.
     */
    function revokeConfirmation(uint _txIndex) public override onlyOwnerOrGov txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /**
     * @dev Returns the owners of this contract.
     */
    function getOwners() public view override returns (address[] memory) {
        return owners;
    }

    /**
     * @dev Returns the number of transactions confirmed and unconfirmed.
     */
    function getTransactionCount() public view override returns (uint) {
        return transactions.length;
    }

    /**
     * @dev Returns a transactions details.
     * @param _txIndex Transaction Index.
     */
    function getTransaction(uint _txIndex)
        public
        view
        override
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
