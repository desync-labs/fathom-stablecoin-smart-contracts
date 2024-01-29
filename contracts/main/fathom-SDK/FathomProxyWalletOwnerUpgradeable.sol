// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IProxyWalletRegistry.sol";
import "../interfaces/IProxyWallet.sol";
import "../interfaces/IToken.sol";

error InvalidAddress();
error InvalidUint();
error PositionAlreadyClosed();
error EtherTransferFailed(address recipient);

contract FathomProxyWalletOwnerUpgradeable is OwnableUpgradeable {
    uint256 internal constant RAY = 10 ** 27;

    address public proxyWalletRegistry;
    address public bookKeeper;
    address public collateralPoolConfig;
    address public stablecoinAddress;
    address public positionManager;
    address public stabilityFeeCollector;
    address public collateralTokenAdapter;
    address public stablecoinAdapter;
    address public proxyWallet;
    bytes32 public collateralPoolId;
    event OpenPosition(uint256 _collateralAmount, uint256 _stablecoinBorrowed);
    event ClosePosition(uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinPaid, bool _fullClosure);
    event WithdrawStablecoin(address _to, uint256 _stablecoinAmount);
    event WithdrawXDC(address _to, uint256 _xdcAmount);
    event Received(address _sender, uint256 _amount);

    constructor() {
        _disableInitializers();
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function initialize(
        address _proxyWalletRegistry,
        address _bookKeeper,
        address _collateralPoolConfig,
        address _stablecoinAddress,
        address _positionManager,
        address _stabilityFeeCollector,
        address _collateralTokenAdapter,
        address _stablecoinAdapter,
        bytes32 _collateralPoolId
    ) external initializer {
        __Ownable_init();
        _validateAddress(_proxyWalletRegistry);
        _validateAddress(_bookKeeper);
        _validateAddress(_collateralPoolConfig);
        _validateAddress(_stablecoinAddress);
        _validateAddress(_positionManager);
        _validateAddress(_stabilityFeeCollector);
        _validateAddress(_collateralTokenAdapter);
        _validateAddress(_stablecoinAdapter);
        _validateUint(uint256(_collateralPoolId));
        proxyWalletRegistry = _proxyWalletRegistry;
        bookKeeper = _bookKeeper;
        collateralPoolConfig = _collateralPoolConfig;
        stablecoinAddress = _stablecoinAddress;
        positionManager = _positionManager;
        stabilityFeeCollector = _stabilityFeeCollector;
        collateralTokenAdapter = _collateralTokenAdapter;
        stablecoinAdapter = _stablecoinAdapter;
        collateralPoolId = _collateralPoolId;
    }

    function buildProxyWallet() external onlyOwner {
        require(proxyWallet == address(0), "proxyWallet-already-init");
        proxyWallet = IProxyWalletRegistry(proxyWalletRegistry).build(address(this));
    }

    function openPosition(uint256 _stablecoinAmount) external payable onlyOwner {
        _validateUint(_stablecoinAmount);
        _validateAddress(proxyWallet);
        bytes memory openPositionEncoding = abi.encodeWithSignature(
            "openLockXDCAndDraw(address,address,address,address,bytes32,uint256,bytes)",
            positionManager,
            stabilityFeeCollector,
            collateralTokenAdapter,
            stablecoinAdapter,
            collateralPoolId,
            _stablecoinAmount,
            bytes(hex"00")
        );
        IProxyWallet(proxyWallet).execute{ value: msg.value }(openPositionEncoding);
        IToken(stablecoinAddress).transfer(msg.sender, IToken(stablecoinAddress).balanceOf(address(this)));
        emit OpenPosition(msg.value, _stablecoinAmount);
    }

    function closePositionPartial(uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount) external onlyOwner {
        _validateUint(_positionId);
        _validateUint(_collateralAmount);
        _validateUint(_stablecoinAmount);
        _validateAddress(proxyWallet);
        (uint256 lockedCollateral, ) = positions(_positionId);
        _positionClosureCheck(lockedCollateral);
        IToken(stablecoinAddress).approve(proxyWallet, IToken(stablecoinAddress).balanceOf(address(this)));
        bytes memory closePositionPartialEncoding = abi.encodeWithSignature(
            "wipeAndUnlockXDC(address,address,address,uint256,uint256,uint256,bytes)",
            positionManager,
            collateralTokenAdapter,
            stablecoinAdapter,
            _positionId,
            _collateralAmount,
            _stablecoinAmount,
            bytes(hex"00")
        );
        IProxyWallet(proxyWallet).execute(closePositionPartialEncoding);
        (bool sent, ) = payable(msg.sender).call{ value: address(this).balance }("");
        _successfullXDCTransfer(sent);
        emit ClosePosition(_positionId, _collateralAmount, _stablecoinAmount, false);
    }

    function closePositionFull(uint256 _positionId) external onlyOwner {
        _validateUint(_positionId);
        _validateAddress(proxyWallet);
        _validateAddress(bookKeeper);
        (uint256 lockedCollateral, ) = positions(_positionId);
        _positionClosureCheck(lockedCollateral);
        uint256 balanceBefore = IToken(stablecoinAddress).balanceOf(address(this));
        IToken(stablecoinAddress).approve(proxyWallet, balanceBefore);
        bytes memory closePositionFullEncoding = abi.encodeWithSignature(
            "wipeAllAndUnlockXDC(address,address,address,uint256,uint256,bytes)",
            positionManager,
            collateralTokenAdapter,
            stablecoinAdapter,
            _positionId,
            lockedCollateral,
            bytes(hex"00")
        );
        IProxyWallet(proxyWallet).execute(closePositionFullEncoding);
        uint256 balanceAfter = IToken(stablecoinAddress).balanceOf(address(this));

        (bool sent, ) = payable(msg.sender).call{ value: address(this).balance }("");
        _successfullXDCTransfer(sent);
        emit ClosePosition(_positionId, lockedCollateral, balanceBefore - balanceAfter, true);
    }

    function withdrawStablecoin() external onlyOwner {
        uint256 stablecoinBalance = IToken(stablecoinAddress).balanceOf(address(this));
        require(stablecoinBalance != 0, "zero-stablecoin-balance");
        IToken(stablecoinAddress).transfer(msg.sender, stablecoinBalance);
        emit WithdrawStablecoin(msg.sender, stablecoinBalance);
    }

    function withdrawXDC() external onlyOwner {
        uint256 balanceXDC = address(this).balance;
        require(balanceXDC != 0, "zero-xdc-balance");
        (bool sent, ) = payable(msg.sender).call{ value: balanceXDC }("");
        _successfullXDCTransfer(sent);
        emit WithdrawXDC(msg.sender, balanceXDC);
    }

    function ownerFirstPositionId() external view returns (uint256 positionId) {
        _validateAddress(proxyWallet);
        _validateAddress(positionManager);
        return IManager(positionManager).ownerFirstPositionId(proxyWallet);
    }

    function ownerLastPositionId() external view returns (uint256 positionId) {
        _validateAddress(proxyWallet);
        _validateAddress(positionManager);
        return IManager(positionManager).ownerLastPositionId(proxyWallet);
    }

    function ownerPositionCount() external view returns (uint256 positionCount) {
        _validateAddress(proxyWallet);
        _validateAddress(positionManager);
        return IManager(positionManager).ownerPositionCount(proxyWallet);
    }

    function list(uint256 _positionId) external view returns (uint256 prev, uint256 next) {
        _validateUint(_positionId);
        _validateAddress(proxyWallet);
        _validateAddress(positionManager);
        return IManager(positionManager).list(_positionId);
    }

    function getActualFXDToRepay(uint256 _positionId) public view returns (uint256) {
        (, uint256 debtShare) = positions(_positionId);
        return (debtShare * getDebtAccumulatedRate()) / RAY;
    }

    function getDebtAccumulatedRate() public view returns (uint256) {
        _validateAddress(collateralPoolConfig);
        _validateUint(uint256(collateralPoolId));
        return ICollateralPoolConfig(collateralPoolConfig).getDebtAccumulatedRate(collateralPoolId);
    }

    function getPositionAddress(uint256 _positionId) public view returns (address positionAddress) {
        _validateUint(_positionId);
        _validateAddress(positionManager);
        return IManager(positionManager).positions(_positionId);
    }

    function positions(uint256 _positionId) public view returns (uint256 lockedCollateral, uint256 debtShare) {
        _validateUint(_positionId);
        _validateAddress(bookKeeper);
        return IBookKeeper(bookKeeper).positions(collateralPoolId, getPositionAddress(_positionId));
    }

    function _successfullXDCTransfer(bool _sent) internal view {
        if (!_sent) revert EtherTransferFailed(msg.sender);
    }

    function _validateAddress(address _address) internal pure {
        if (_address == address(0)) revert InvalidAddress();
    }

    function _validateUint(uint256 _uintValue) internal pure {
        if (_uintValue == 0) revert InvalidUint();
    }

    function _positionClosureCheck(uint256 _lockedCollateral) internal pure {
        if (_lockedCollateral == 0) revert PositionAlreadyClosed();
    }
}
