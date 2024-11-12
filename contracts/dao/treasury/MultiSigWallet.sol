// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./interfaces/IMultiSigWallet.sol";
import "../../common/Address.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

// solhint-disable not-rely-on-time
contract MultiSigWallet is IMultiSigWallet {
    using Address for address;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Transaction {
        address to;
        bool executed;
        bytes data;
        uint256 value;
        uint256 numConfirmations;
        uint256 expireTimestamp;
    }

    address public governor;
    uint256 public numConfirmationsRequired;
    mapping(address => bool) public isOwner;
    Transaction[] public transactions;
    uint256 public firstValidTransactionIndexAfterOwnerRemoval;

    EnumerableSet.AddressSet internal owners;
    mapping(address => mapping(uint256 => bytes32)) internal allowlistedBytesCode;
    mapping(address => EnumerableSet.UintSet) internal confirmedTransactionsByOwner;

    uint256 public constant MINIMUM_LIFETIME = 86400; //oneDay
    //Most common used lifetime is 30 days, Maximum lifetime is 60 days which allows for more complex transactions to proceed with ample time
    uint256 public constant MAXIMUM_LIFETIME = 60 * 86400; //60Days
    uint256 public constant MAX_OWNER_COUNT = 50;

    error TxDoesNotExist();
    error TxAlreadyExecuted();
    error TxAlreadyConfirmed();
    error TxExpired();
    error OnlyOwnerOrGov();
    error OnlyOwner();
    error InvalidRequirement();
    error OwnerNotFound();
    error LifetimeMinimumNotMet();
    error InsufficientBalance();
    error InsufficientValueOrBadCalldata();
    error TargetCodeChanged();
    error ExistingOwner();
    error TxNotConfirmed();
    error OnlyWallet();
    error LifetimeMaximumExceeded();
    error TxNotValidBecauseOwnerWasRemoved();
    error InvalidZeroAddress();

    modifier onlyOwnerOrGov() {
        if (!isOwner[msg.sender] && governor != msg.sender) {
            revert OnlyOwnerOrGov();
        }
        _;
    }

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) {
            revert OnlyOwner();
        }
        _;
    }

    modifier txExists(uint256 _txIndex) {
        if (_txIndex >= transactions.length) {
            revert TxDoesNotExist();
        }
        _;
    }

    modifier txIndexGoesAfterLastOwnerRemoval(uint256 _txIndex) {
        if (_txIndex < firstValidTransactionIndexAfterOwnerRemoval) {
            revert TxNotValidBecauseOwnerWasRemoved();
        }
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        if (transactions[_txIndex].executed) {
            revert TxAlreadyExecuted();
        }
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        if (confirmedTransactionsByOwner[msg.sender].contains(_txIndex)) {
            revert TxAlreadyConfirmed();
        }
        _;
    }

    modifier notExpired(uint256 _txIndex) {
        if (transactions[_txIndex].expireTimestamp < block.timestamp && transactions[_txIndex].expireTimestamp != 0) {
            revert TxExpired();
        }
        _;
    }

    modifier onlyWallet() {
        if (msg.sender != address(this)) {
            revert OnlyWallet();
        }
        _;
    }

    modifier ownerExists(address owner) {
        if (!isOwner[owner]) {
            revert OwnerNotFound();
        }
        _;
    }

    modifier validateSubmitTxInputs(
        address _to,
        uint256 _value,
        bytes memory _data,
        uint256 _lifetime
    ) {
        if (_lifetime < MINIMUM_LIFETIME && _lifetime > 0) {
            revert LifetimeMinimumNotMet();
        }

        if (_lifetime > MAXIMUM_LIFETIME) {
            revert LifetimeMaximumExceeded();
        }

        if (!_to.isContract()) {
            if (_data.length > 0 || _value == 0) {
                revert InsufficientValueOrBadCalldata();
            }
        }
        if (address(this).balance < _value) {
            revert InsufficientBalance();
        }
        _;
    }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired, address _governor) {
        _validRequirement(_owners.length, _numConfirmationsRequired);

        governor = _governor;

        _addOwners(_owners);

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable override {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function removeOwner(address owner) external override onlyWallet ownerExists(owner) {
        isOwner[owner] = false;
        owners.remove(owner);

        // Remove the previous statistic of transactions confirmations.
        firstValidTransactionIndexAfterOwnerRemoval = transactions.length;

        if (numConfirmationsRequired > owners.length()) _changeRequirement(owners.length());

        emit OwnerRemoval(owner);
    }

    function addOwners(address[] calldata _owners, uint256 _newNumConfirmationsRequired) external override onlyWallet {
        if (_newNumConfirmationsRequired < numConfirmationsRequired) {
            revert InvalidRequirement();
        }
        _validRequirement(owners.length() + _owners.length, _newNumConfirmationsRequired);

        _addOwners(_owners);
        if (_newNumConfirmationsRequired != numConfirmationsRequired) _changeRequirement(_newNumConfirmationsRequired);
    }

    function changeRequirement(uint256 _newNumConfirmationsRequired) external override onlyWallet {
        if (_newNumConfirmationsRequired == numConfirmationsRequired) {
            revert InvalidRequirement();
        }
        _validRequirement(owners.length(), _newNumConfirmationsRequired);

        _changeRequirement(_newNumConfirmationsRequired);
    }

    function submitTransaction(
        address _to,
        uint256 _value,
        bytes calldata _data,
        uint256 _lifetime
    ) external override onlyOwnerOrGov validateSubmitTxInputs(_to, _value, _data, _lifetime) {
        uint256 txIndex = transactions.length;
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0,
                expireTimestamp: _lifetime == 0 ? 0 : block.timestamp + _lifetime
            })
        );

        allowlistedBytesCode[_to][txIndex] = _to.getExtCodeHash();

        emit SubmitTransaction(txIndex, msg.sender, _to, _value, _data);
    }

    function confirmTransaction(
        uint256 _txIndex
    )
        external
        override
        onlyOwner
        txExists(_txIndex)
        txIndexGoesAfterLastOwnerRemoval(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
        notExpired(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        _requireTargetCodeNotChanged(transaction.to, _txIndex);

        transaction.numConfirmations += 1;
        confirmedTransactionsByOwner[msg.sender].add(_txIndex);

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    function executeTransaction(
        uint256 _txIndex
    ) external override onlyOwnerOrGov txExists(_txIndex) txIndexGoesAfterLastOwnerRemoval(_txIndex) notExecuted(_txIndex) notExpired(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        _requireTargetCodeNotChanged(transaction.to, _txIndex);

        if (transaction.numConfirmations < numConfirmationsRequired) {
            revert TxNotConfirmed();
        }

        transaction.executed = true;

        (bool success, bytes memory data) = transaction.to.call{ value: transaction.value }(transaction.data);

        if (success) {
            emit ExecuteTransaction(msg.sender, _txIndex);
        } else {
            Address.verifyCallResult(success, data, "executeTransaction: reverted without reason");
        }
    }

    function revokeConfirmation(
        uint256 _txIndex
    ) external override onlyOwner txExists(_txIndex) txIndexGoesAfterLastOwnerRemoval(_txIndex) notExecuted(_txIndex) notExpired(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        if (!confirmedTransactionsByOwner[msg.sender].contains(_txIndex)) {
            revert TxNotConfirmed();
        }

        transaction.numConfirmations -= 1;
        confirmedTransactionsByOwner[msg.sender].remove(_txIndex);
        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function getOwners() external view override returns (address[] memory) {
        return owners.values();
    }

    function getTransactionCount() external view override returns (uint256) {
        return transactions.length;
    }

    function getTransaction(
        uint256 _txIndex
    )
        external
        view
        override
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations, uint256 expireTimestamp)
    {
        Transaction memory transaction = transactions[_txIndex];

        return (transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations, transaction.expireTimestamp);
    }

    function isConfirmedByOwner(uint256 _txIndex, address _owner) external view override returns (bool) {
        return confirmedTransactionsByOwner[_owner].contains(_txIndex);
    }

    function _changeRequirement(uint256 _required) internal {
        numConfirmationsRequired = _required;
        emit RequirementChange(_required);
    }

    function _addOwners(address[] memory _owners) internal {
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            _notZeroAddress(owner);
            _requireNotOwner(owner);

            isOwner[owner] = true;
            owners.add(owner);
            emit OwnerAddition(owner);
        }
    }

    function _requireNotOwner(address owner) internal view {
        if (isOwner[owner]) {
            revert ExistingOwner();
        }
    }

    function _requireTargetCodeNotChanged(address target, uint256 txIndex) internal view {
        if (allowlistedBytesCode[target][txIndex] != target.getExtCodeHash()) {
            revert TargetCodeChanged();
        }
    }

    function _validRequirement(uint256 ownerCount, uint256 _required) internal pure {
        // if owners count more than 1, then required should be more than 1 - it will protect from centralization
        if (ownerCount == 0 || ownerCount > MAX_OWNER_COUNT || _required > ownerCount || !(ownerCount > 1 ? _required > 1 : _required > 0)) {
            revert InvalidRequirement();
        }
    }

    function _notZeroAddress(address _address) internal pure {
        if (_address == address(0)) {
            revert InvalidZeroAddress();
        }
    }
}
