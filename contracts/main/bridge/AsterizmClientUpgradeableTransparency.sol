// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "asterizmprotocol/contracts/evm/interfaces/IInitializerSender.sol";
import "asterizmprotocol/contracts/evm/interfaces/IClientReceiverContract.sol";
import "asterizmprotocol/contracts/evm/base/AsterizmEnv.sol";
import "asterizmprotocol/contracts/evm/base/AsterizmWithdrawalUpgradeable.sol";
import "asterizmprotocol/contracts/evm/libs/AddressLib.sol";
import "asterizmprotocol/contracts/evm/libs/UintLib.sol";
import "asterizmprotocol/contracts/evm/libs/AsterizmHashLib.sol";

abstract contract AsterizmClientUpgradeableTransparency is IClientReceiverContract, AsterizmEnv, AsterizmWithdrawalUpgradeable {

    using AddressLib for address;
    using UintLib for uint;
    using AsterizmHashLib for bytes;

    /// Set initializer event
    /// @param _initializerAddress address  Initializer address
    event SetInitializerEvent(address _initializerAddress);

    /// Set external relay event
    /// @param _externalRelayAddress address  External relay address
    event SetExternalRelayEvent(address _externalRelayAddress);

    /// Set fee token event
    /// @param _feeTokenAddress address  Fee token address
    event SetFeeTokenEvent(address _feeTokenAddress);

    /// Set local chain id event
    /// @param _localChainId uint64
    event SetLocalChainIdEvent(uint64 _localChainId);

    /// Initiate transfer event (for client server logic)
    /// @param _dstChainId uint64  Destination chein ID
    /// @param _dstAddress uint  Destination address
    /// @param _txId uint  Transaction ID
    /// @param _transferHash bytes32  Transfer hash
    /// @param _payload bytes  Payload
    event InitiateTransferEvent(uint64 _dstChainId, uint _dstAddress, uint _txId, bytes32 _transferHash, bytes _payload);

    /// Payload receive event (for client server logic)
    /// @param _srcChainId uint64  Source chain ID
    /// @param _srcAddress uint  Source address
    /// @param _txId uint  Transfer ID
    /// @param _transferHash bytes32  Transaction hash
    event PayloadReceivedEvent(uint64 _srcChainId, uint _srcAddress, uint _txId, bytes32 _transferHash);

    /// Add sender event
    /// @param _sender address  Sender address
    event AddSenderEvent(address _sender);

    /// Remove sender event
    /// @param _sender address  Sender address
    event RemoveSenderEvent(address _sender);

    /// Add trusted address event
    /// @param _chainId uint64  Chain ID
    /// @param _address uint  Trusted address
    event AddTrustedAddressEvent(uint64 _chainId, uint _address);

    /// Remove trusted address event
    /// @param _chainId uint64  Chain ID
    /// @param _address uint  Trusted address
    event RemoveTrustedAddressEvent(uint64 _chainId, uint _address);

    /// Set notify transfer sending result event
    /// @param _flag bool  Notify transfer sending result flag
    event SetNotifyTransferSendingResultEvent(bool _flag);

    /// Set disable hash validation flag event
    /// @param _flag bool  Use force order flag
    event SetDisableHashValidationEvent(bool _flag);

    /// Resend Asterizm transfer event
    /// @param _transferHash bytes32  Transfer hash
    /// @param _feeAmount uint  Additional fee amount
    event ResendAsterizmTransferEvent(bytes32 _transferHash, uint _feeAmount);

    /// Transfer sending result notification event
    /// @param _transferHash bytes32  Transfer hash
    /// @param _statusCode uint8  Status code
    event TransferSendingResultNotification(bytes32 indexed _transferHash, uint8 _statusCode);

    struct AsterizmTransfer {
        bool successReceive;
        bool successExecute;
    }

    struct AsterizmChain {
        bool exists;
        uint trustedAddress;
        uint8 chainType;
    }
    struct Sender {
        bool exists;
    }

    IInitializerSender private initializerLib;
    address private externalRelay;
    mapping(uint64 => AsterizmChain) private trustedAddresses;
    mapping(bytes32 => AsterizmTransfer) private inboundTransfers;
    mapping(bytes32 => AsterizmTransfer) private outboundTransfers;
    mapping(address => Sender) private senders;
    bool private notifyTransferSendingResult;
    bool private disableHashValidation;
    uint private txId;
    uint64 private localChainId;
    IERC20 private feeToken;

    /// Initializing function for upgradeable contracts (constructor)
    /// @param _initializerLib IInitializerSender  Initializer library address
    /// @param _notifyTransferSendingResult bool  Transfer sending result notification flag
    /// @param _disableHashValidation bool  Disable hash validation flag
    function _asterizm_initialize(IInitializerSender _initializerLib, bool _notifyTransferSendingResult, bool _disableHashValidation) internal {
        __Ownable_init();
        __ReentrancyGuard_init();

        _setInitializer(_initializerLib);
        _setLocalChainId(initializerLib.getLocalChainId());
        _setNotifyTransferSendingResult(_notifyTransferSendingResult);
        _setDisableHashValidation(_disableHashValidation);
        addSender(owner());
        addTrustedAddress(localChainId, address(this).toUint());
    }

    /// Only initializer modifier
    modifier onlyInitializer {
        require(msg.sender == address(initializerLib), "AsterizmClient: only initializer");
        _;
    }

    /// Only owner or initializer modifier
    modifier onlyOwnerOrInitializer {
        require(msg.sender == owner() || msg.sender == address(initializerLib), "AsterizmClient: only owner or initializer");
        _;
    }

    /// Only sender modifier
    modifier onlySender {
        require(senders[msg.sender].exists, "AsterizmClient: only sender");
        _;
    }

    /// Only sender or owner modifier
    modifier onlySenderOrOwner {
        require(msg.sender == owner() || senders[msg.sender].exists, "AsterizmClient: only sender or owner");
        _;
    }

    /// Only trusted address modifier
    /// You must add trusted addresses in production networks!
    modifier onlyTrustedAddress(uint64 _chainId, uint _address) {
        require(trustedAddresses[_chainId].trustedAddress == _address, "AsterizmClient: wrong source address");
        _;
    }

    /// Only trusted trarnsfer modifier
    /// Validate transfer hash on initializer
    /// Use this modifier for validate transfer by hash
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyTrustedTransfer(bytes32 _transferHash) {
        require(initializerLib.validIncomeTransferHash(_transferHash), "AsterizmClient: transfer hash is invalid");
        _;
    }

    /// Only received transfer modifier
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyReceivedTransfer(bytes32 _transferHash) {
        require(inboundTransfers[_transferHash].successReceive, "AsterizmClient: transfer not received");
        _;
    }

    /// Only non-executed transfer modifier
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyNonExecuted(bytes32 _transferHash) {
        require(!inboundTransfers[_transferHash].successExecute, "AsterizmClient: transfer executed already");
        _;
    }

    /// Only exists outbound transfer modifier
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyExistsOutboundTransfer(bytes32 _transferHash) {
        require(outboundTransfers[_transferHash].successReceive, "AsterizmClient: outbound transfer not exists");
        _;
    }

    /// Only not executed outbound transfer modifier
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyNotExecutedOutboundTransfer(bytes32 _transferHash) {
        require(!outboundTransfers[_transferHash].successExecute, "AsterizmClient: outbound transfer executed already");
        _;
    }

    /// Only executed outbound transfer modifier
    /// @param _transferHash bytes32  Transfer hash
    modifier onlyExecutedOutboundTransfer(bytes32 _transferHash) {
        require(outboundTransfers[_transferHash].successExecute, "AsterizmClient: outbound transfer not executed");
        _;
    }

    /// Only nvalid transfer hash modifier
    /// @param _dto ClAsterizmReceiveRequestDto  Transfer data
    modifier onlyValidTransferHash(ClAsterizmReceiveRequestDto memory _dto) {
        if (!disableHashValidation) {
            require(
                _validTransferHash(_dto.srcChainId, _dto.srcAddress, _dto.dstChainId, _dto.dstAddress, _dto.txId, _dto.payload, _dto.transferHash),
                "AsterizmClient: transfer hash is invalid"
            );
        }
        _;
    }

    /** Internal logic */

    /// Set initizlizer library
    /// _initializerLib IInitializerSender  Initializer library
    function _setInitializer(IInitializerSender _initializerLib) private {
        initializerLib = _initializerLib;
        emit SetInitializerEvent(address(_initializerLib));
    }

    /// Set local chain id library
    /// _localChainId uint64
    function _setLocalChainId(uint64 _localChainId) private {
        localChainId = _localChainId;
        emit SetLocalChainIdEvent(_localChainId);
    }

    /// Set notify transfer sending result
    /// _flag bool  Transfer sending result notification flag
    function _setNotifyTransferSendingResult(bool _flag) private {
        notifyTransferSendingResult = _flag;
        emit SetNotifyTransferSendingResultEvent(_flag);
    }

    /// Set disable hash validation flag
    /// _flag bool  Disable hash validation flag
    function _setDisableHashValidation(bool _flag) private {
        disableHashValidation = _flag;
        emit SetDisableHashValidationEvent(_flag);
    }

    /// Return chain type by id
    /// @param _chainId uint64  Chain id
    /// @return uint8  Chain type
    function _getChainType(uint64 _chainId) internal view returns(uint8) {
        return initializerLib.getChainType(_chainId);
    }

    /// Set external relay address (one-time initiation)
    /// _externalRelay address  External relay address
    function setExternalRelay(address _externalRelay) public onlyOwner {
        require(externalRelay == address(0), "AsterizmClient: relay changing not available");
        externalRelay = _externalRelay;
        emit SetExternalRelayEvent(_externalRelay);
    }

    /// Return external relay
    /// @return address  External relay address
    function getExternalRelay() external view returns(address) {
        return externalRelay;
    }

    /// Set external relay address (one-time initiation)
    /// _feeToken IERC20  External relay address
    function setFeeToken(IERC20 _feeToken) public onlyOwner {
        feeToken = _feeToken;
        emit SetFeeTokenEvent(address(_feeToken));
    }

    /// Return fee token
    /// @return address  Fee token address
    function getFeeToken() external view returns(address) {
        return address(feeToken);
    }

    /// Add sender
    /// @param _sender address  Sender address
    function addSender(address _sender) public onlyOwner {
        senders[_sender].exists = true;
        emit AddSenderEvent(_sender);
    }

    /// Remove sender
    /// @param _sender address  Sender address
    function removeSender(address _sender) public onlyOwner {
        require(senders[_sender].exists, "AsterizmClient: sender not exists");
        delete senders[_sender];
        emit RemoveSenderEvent(_sender);
    }

    /// Add trusted address
    /// @param _chainId uint64  Chain ID
    /// @param _trustedAddress address  Trusted address
    function addTrustedAddress(uint64 _chainId, uint _trustedAddress) public onlyOwner {
        trustedAddresses[_chainId].exists = true;
        trustedAddresses[_chainId].trustedAddress = _trustedAddress;
        trustedAddresses[_chainId].chainType = initializerLib.getChainType(_chainId);

        emit AddTrustedAddressEvent(_chainId, _trustedAddress);
    }

    /// Add trusted addresses
    /// @param _chainIds uint64[]  Chain IDs
    /// @param _trustedAddresses uint[]  Trusted addresses
    function addTrustedAddresses(uint64[] calldata _chainIds, uint[] calldata _trustedAddresses) external onlyOwner {
        for (uint i = 0; i < _chainIds.length; i++) {
            addTrustedAddress(_chainIds[i], _trustedAddresses[i]);
        }
    }

    /// Remove trusted address
    /// @param _chainId uint64  Chain ID
    function removeTrustedAddress(uint64 _chainId) external onlyOwner {
        require(trustedAddresses[_chainId].exists, "AsterizmClient: trusted address not found");
        uint removingAddress = trustedAddresses[_chainId].trustedAddress;
        delete trustedAddresses[_chainId];

        emit RemoveTrustedAddressEvent(_chainId, removingAddress);
    }

    /// Build transfer hash
    /// @param _srcChainId uint64  Chain ID
    /// @param _srcAddress uint  Address
    /// @param _dstChainId uint64  Chain ID
    /// @param _dstAddress uint  Address
    /// @param _txId uint  Transaction ID
    /// @param _payload bytes  Payload
    function _buildTransferHash(uint64 _srcChainId, uint _srcAddress, uint64 _dstChainId, uint _dstAddress, uint _txId, bytes memory _payload) internal view returns(bytes32) {
        bytes memory encodeData = abi.encodePacked(_srcChainId, _srcAddress, _dstChainId, _dstAddress, _txId, _buildPackedPayload(_payload));

        return _getChainType(_srcChainId) == _getChainType(_dstChainId) ? encodeData.buildSimpleHash() : encodeData.buildCrosschainHash();
    }

    /// Check is transfer hash valid
    /// @param _srcChainId uint64  Chain ID
    /// @param _srcAddress uint  Address
    /// @param _dstChainId uint64  Chain ID
    /// @param _dstAddress uint  Address
    /// @param _txId uint  Transaction ID
    /// @param _payload bytes  Packed payload
    /// @param _transferHash bytes32  Transfer hash
    function _validTransferHash(uint64 _srcChainId, uint _srcAddress, uint64 _dstChainId, uint _dstAddress, uint _txId, bytes memory _payload, bytes32 _transferHash) internal view returns(bool) {
        return _buildTransferHash(_srcChainId, _srcAddress, _dstChainId, _dstAddress, _txId, _payload) == _transferHash;
    }

    /// Return txId
    /// @return uint
    function _getTxId() internal view returns(uint) {
        return txId;
    }

    /// Return local chain id
    /// @return uint64
    function _getLocalChainId() internal view returns(uint64) {
        return localChainId;
    }

    /// Return initializer address
    /// @return address
    function getInitializerAddress() external view returns(address) {
        return address(initializerLib);
    }

    /// Return trusted src addresses
    /// @param _chainId uint64  Chain id
    /// @return AsterizmChain
    function getTrustedAddresses(uint64 _chainId) external view returns(AsterizmChain memory) {
        return trustedAddresses[_chainId];
    }

    /// Return disable hash validation flag
    /// @return bool
    function getDisableHashValidation() external view returns(bool) {
        return disableHashValidation;
    }

    /// Return notify transfer sending result flag
    /// @return bool
    function getNotifyTransferSendingResult() external view returns(bool) {
        return notifyTransferSendingResult;
    }

    /** Sending logic */

    /// Initiate transfer event
    /// Generate event for client server
    /// @param _dstChainId uint64  Destination chain ID
    /// @param _payload bytes  Payload
    function _initAsterizmTransferEvent(uint64 _dstChainId, bytes memory _payload) internal {
        require(trustedAddresses[_dstChainId].exists, "AsterizmClient: trusted address not found");
        uint id = txId++;
        bytes32 transferHash = _buildTransferHash(_getLocalChainId(), address(this).toUint(), _dstChainId, trustedAddresses[_dstChainId].trustedAddress, id, _payload);
        outboundTransfers[transferHash].successReceive = true;
        emit InitiateTransferEvent(_dstChainId, trustedAddresses[_dstChainId].trustedAddress, id, transferHash, _payload);
    }

    /// External initiation transfer
    /// This function needs for external initiating non-encoded payload transfer
    /// @param _dstChainId uint64  Destination chain ID
    /// @param _transferHash bytes32  Transfer hash
    /// @param _txId uint  Transaction ID
    function initAsterizmTransfer(uint64 _dstChainId, uint _txId, bytes32 _transferHash) external payable onlySender nonReentrant {
        require(trustedAddresses[_dstChainId].exists, "AsterizmClient: trusted address not found");
        ClInitTransferRequestDto memory dto = _buildClInitTransferRequestDto(_dstChainId, trustedAddresses[_dstChainId].trustedAddress, _txId, _transferHash, msg.value);
        _initAsterizmTransferPrivate(dto);
    }

    /// Private initiation transfer
    /// This function needs for internal initiating non-encoded payload transfer
    /// @param _dto ClInitTransferRequestDto  Init transfer DTO
    function _initAsterizmTransferPrivate(ClInitTransferRequestDto memory _dto) private
    onlyExistsOutboundTransfer(_dto.transferHash)
    onlyNotExecutedOutboundTransfer(_dto.transferHash)
    {
        require(address(this).balance >= _dto.feeAmount, "AsterizmClient: contract balance is not enough");
        require(_dto.txId <= _getTxId(), "AsterizmClient: wrong txId param");

        IzInitTransferRequestDto memory initDto = _buildIzInitTransferRequestDto(
            _dto.dstChainId, _dto.dstAddress, _dto.txId, _dto.transferHash,
            externalRelay, notifyTransferSendingResult, address(feeToken)
        );

        if (address(feeToken) != address(0)) {
            uint feeAmountInToken = initializerLib.getFeeAmountInTokens(externalRelay, initDto);
            if (feeAmountInToken > 0) {
                require(feeToken.balanceOf(address(this)) >= feeAmountInToken, "AsterizmClient: fee token balance is not enough");
                feeToken.approve(address(initializerLib), feeAmountInToken);
            }
        }

        initializerLib.initTransfer{value: _dto.feeAmount} (initDto);
        outboundTransfers[_dto.transferHash].successExecute = true;
    }

    /// Resend failed by fee amount transfer
    /// @param _transferHash bytes32  Transfer hash
    function resendAsterizmTransfer(bytes32 _transferHash) external payable
    onlyOwner
    onlyExistsOutboundTransfer(_transferHash)
    onlyExecutedOutboundTransfer(_transferHash)
    {
        initializerLib.resendTransfer{value: msg.value}(_transferHash, externalRelay);
        emit ResendAsterizmTransferEvent(_transferHash, msg.value);
    }

    /// Transfer sending result notification
    /// @param _transferHash bytes32  Transfer hash
    /// @param _statusCode uint8  Status code
    function transferSendingResultNotification(bytes32 _transferHash, uint8 _statusCode) external onlyInitializer onlyExecutedOutboundTransfer(_transferHash) {
        if (notifyTransferSendingResult) {
            emit TransferSendingResultNotification(_transferHash, _statusCode);
        }
    }

    /** Receiving logic */

    /// Receive payload from initializer
    /// @param _dto IzAsterizmReceiveRequestDto  Method DTO
    function asterizmIzReceive(IzAsterizmReceiveRequestDto calldata _dto) external onlyInitializer {
        _asterizmReceiveExternal(_dto);
    }

    /// Receive external payload
    /// @param _dto IzAsterizmReceiveRequestDto  Method DTO
    function _asterizmReceiveExternal(IzAsterizmReceiveRequestDto calldata _dto) private
    onlyOwnerOrInitializer
    onlyTrustedAddress(_dto.srcChainId, _dto.srcAddress)
    onlyNonExecuted(_dto.transferHash)
    {
        inboundTransfers[_dto.transferHash].successReceive = true;
        emit PayloadReceivedEvent(_dto.srcChainId, _dto.srcAddress, _dto.txId, _dto.transferHash);
    }

    /// Receive payload from client server
    /// @param _srcChainId uint64  Source chain ID
    /// @param _srcAddress uint  Source address
    /// @param _txId uint  Transaction ID
    /// @param _transferHash bytes32  Transfer hash
    /// @param _payload bytes  Payload
    function asterizmClReceive(uint64 _srcChainId, uint _srcAddress, uint _txId, bytes32 _transferHash, bytes calldata _payload) external onlySender nonReentrant {
        ClAsterizmReceiveRequestDto memory dto = _buildClAsterizmReceiveRequestDto(_srcChainId, _srcAddress, localChainId, address(this).toUint(), _txId, _transferHash, _payload);
        _asterizmReceiveInternal(dto);
    }

    /// Receive non-encoded payload for internal usage
    /// @param _dto ClAsterizmReceiveRequestDto  Method DTO
    function _asterizmReceiveInternal(ClAsterizmReceiveRequestDto memory _dto) private
    onlyOwnerOrInitializer
    onlyReceivedTransfer(_dto.transferHash)
    onlyTrustedAddress(_dto.srcChainId, _dto.srcAddress)
    onlyTrustedTransfer(_dto.transferHash)
    onlyNonExecuted(_dto.transferHash)
    onlyValidTransferHash(_dto)
    {
        _asterizmReceive(_dto);
        inboundTransfers[_dto.transferHash].successExecute = true;
    }

    /// Receive payload
    /// You must realize this function if you want to transfer payload
    /// If disableHashValidation = true you must validate transferHash with _validTransferHash() method for more security!
    /// @param _dto ClAsterizmReceiveRequestDto  Method DTO
    function _asterizmReceive(ClAsterizmReceiveRequestDto memory _dto) internal virtual {}

    /// Build packed payload (abi.encodePacked() result)
    /// @param _payload bytes  Default payload (abi.encode() result)
    /// @return bytes  Packed payload (abi.encodePacked() result)
    function _buildPackedPayload(bytes memory _payload) internal view virtual returns(bytes memory) {}
}
