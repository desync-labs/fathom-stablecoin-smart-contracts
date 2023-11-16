// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
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

contract FathomProxyWalletOwner is Ownable {
    uint256 internal constant RAY = 10 ** 27;

    address public ProxyWalletRegistry;
    address public BookKeeper;
    address public CollateralPoolConfig;
    address public StablecoinAddress;
    address public PositionManager;
    address public StabilityFeeCollector;
    address public CollateralTokenAdapter;
    address public StablecoinAdapter;
    address public ProxyWallet;
    bytes32 public Collateral_pool_id;
    event OpenPosition(uint256 _collateralAmount, uint256 _stablecoinBorrowed);
    event ClosePosition(uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinPaid, bool _fullClosure);
    event WithdrawStablecoin(address _to, uint256 _stablecoinAmount);
    event WithdrawXDC(address _to, uint256 _xdcAmount);
    event Received(address _sender, uint256 _amount);

    constructor(
        address _proxyWalletRegistry,
        address _bookKeeper,
        address _collateralPoolConfig,
        address _stablecoinAddress,
        address _positionManager,
        address _stabilityFeeCollector,
        address _collateralTokenAdapter,
        address _stablecoinAdapter,
        bytes32 _collateral_pool_id
    ) {
        _validateAddress(_proxyWalletRegistry);
        _validateAddress(_bookKeeper);
        _validateAddress(_collateralPoolConfig);
        _validateAddress(_stablecoinAddress);
        _validateAddress(_positionManager);
        _validateAddress(_stabilityFeeCollector);
        _validateAddress(_collateralTokenAdapter);
        _validateAddress(_stablecoinAdapter);
        _validateUint(uint256(_collateral_pool_id));
        ProxyWalletRegistry = _proxyWalletRegistry;
        BookKeeper = _bookKeeper;
        CollateralPoolConfig = _collateralPoolConfig;
        StablecoinAddress = _stablecoinAddress;
        PositionManager = _positionManager;
        StabilityFeeCollector = _stabilityFeeCollector;
        CollateralTokenAdapter = _collateralTokenAdapter;
        StablecoinAdapter = _stablecoinAdapter;
        Collateral_pool_id = _collateral_pool_id;
    }

    function ownerFirstPositionId() external view returns (uint256 positionId) {
        _validateAddress(ProxyWallet);
        _validateAddress(PositionManager);
        return IManager(PositionManager).ownerFirstPositionId(ProxyWallet);
    }

    function ownerLastPositionId() external view returns (uint256 positionId) {
        _validateAddress(ProxyWallet);
        _validateAddress(PositionManager);
        return IManager(PositionManager).ownerLastPositionId(ProxyWallet);
    }

    function ownerPositionCount() external view returns (uint256 positionCount) {
        _validateAddress(ProxyWallet);
        _validateAddress(PositionManager);
        return IManager(PositionManager).ownerPositionCount(ProxyWallet);
    }

    function list(uint256 _positionId) external view returns (IManager.List memory) {
        _validateUint(_positionId);
        _validateAddress(ProxyWallet);
        _validateAddress(PositionManager);
        return IManager(PositionManager).list(_positionId);
    }

    function buildProxyWallet() external onlyOwner {
        require(ProxyWallet == address(0), "ProxyWallet-already-init");
        ProxyWallet = IProxyWalletRegistry(ProxyWalletRegistry).build(address(this));
    }

    function openPosition(uint256 _stablecoinAmount) external payable onlyOwner {
        _validateUint(_stablecoinAmount);
        _validateAddress(ProxyWallet);
        bytes memory openPositionEncoding = abi.encodeWithSignature(
            "openLockXDCAndDraw(address,address,address,address,bytes32,uint256,bytes)",
            PositionManager,
            StabilityFeeCollector,
            CollateralTokenAdapter,
            StablecoinAdapter,
            Collateral_pool_id,
            _stablecoinAmount,
            bytes(hex"00")
        );
        IProxyWallet(ProxyWallet).execute{ value: msg.value }(openPositionEncoding);
        IToken(StablecoinAddress).transfer(msg.sender, IToken(StablecoinAddress).balanceOf(address(this)));
        emit OpenPosition(msg.value, _stablecoinAmount);
    }

    function closePositionPartial(uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount) external onlyOwner {
        _validateUint(_positionId);
        _validateUint(_collateralAmount);
        _validateUint(_stablecoinAmount);
        _validateAddress(ProxyWallet);
        IBookKeeper.Position memory positionData = positions(_positionId);
        _positionClosureCheck(positionData.lockedCollateral);
        IToken(StablecoinAddress).approve(ProxyWallet, IToken(StablecoinAddress).balanceOf(address(this)));
        bytes memory closePositionFullEncoding = abi.encodeWithSignature(
            "wipeAndUnlockXDC(address,address,address,uint256,uint256,uint256,bytes)",
            PositionManager,
            CollateralTokenAdapter,
            StablecoinAdapter,
            _positionId,
            _collateralAmount,
            _stablecoinAmount,
            bytes(hex"00")
        );
        IProxyWallet(ProxyWallet).execute(closePositionFullEncoding);
        (bool sent, ) = payable(msg.sender).call{ value: address(this).balance }("");
        _successfullXDCTransfer(sent);
        emit ClosePosition(_positionId, _collateralAmount, _stablecoinAmount, false);
    }

    function closePositionFull(uint256 _positionId) external onlyOwner {
        _validateUint(_positionId);
        _validateAddress(ProxyWallet);
        _validateAddress(BookKeeper);
        IBookKeeper.Position memory positionData = positions(_positionId);
        _positionClosureCheck(positionData.lockedCollateral);
        uint256 balanceBefore = IToken(StablecoinAddress).balanceOf(address(this));
        IToken(StablecoinAddress).approve(ProxyWallet, balanceBefore);
        bytes memory closePositionFullEncoding = abi.encodeWithSignature(
            "wipeAllAndUnlockXDC(address,address,address,uint256,uint256,bytes)",
            PositionManager,
            CollateralTokenAdapter,
            StablecoinAdapter,
            _positionId,
            positionData.lockedCollateral,
            bytes(hex"00")
        );
        IProxyWallet(ProxyWallet).execute(closePositionFullEncoding);
        uint256 balanceAfter = IToken(StablecoinAddress).balanceOf(address(this));

        (bool sent, ) = payable(msg.sender).call{ value: address(this).balance }("");
        _successfullXDCTransfer(sent);
        emit ClosePosition(_positionId, positionData.lockedCollateral, balanceBefore - balanceAfter, true);
    }

    function withdrawStablecoin() external onlyOwner {
        uint256 stablecoinBalance = IToken(StablecoinAddress).balanceOf(address(this));
        require(stablecoinBalance != 0, "zero-stablecoin-balance");
        IToken(StablecoinAddress).transfer(msg.sender, stablecoinBalance);
        emit WithdrawStablecoin(msg.sender, stablecoinBalance);
    }

    function withdrawXDC() external onlyOwner {
        uint256 balanceXDC = address(this).balance;
        require(balanceXDC != 0, "zero-xdc-balance");
        (bool sent, ) = payable(msg.sender).call{ value: balanceXDC }("");
        _successfullXDCTransfer(sent);
        emit WithdrawXDC(msg.sender, balanceXDC);
    }

    function getActualFXDToRepay(uint256 _positionId) public view returns (uint256) {
        return (positions(_positionId).debtShare * getDebtAccumulatedRate()) / RAY;
    }

    function getDebtAccumulatedRate() public view returns (uint256) {
        _validateAddress(CollateralPoolConfig);
        _validateUint(uint256(Collateral_pool_id));
        return ICollateralPoolConfig(CollateralPoolConfig).getDebtAccumulatedRate(Collateral_pool_id);
    }

    function getPositionAddress(uint256 _positionId) public view returns (address positionAddress) {
        _validateUint(_positionId);
        _validateAddress(PositionManager);
        return IManager(PositionManager).positions(_positionId);
    }

    function positions(uint256 _positionId) public view returns (IBookKeeper.Position memory) {
        _validateUint(_positionId);
        _validateAddress(BookKeeper);
        return IBookKeeper(BookKeeper).positions(Collateral_pool_id, getPositionAddress(_positionId));
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

    function _successfullXDCTransfer(bool _sent) internal view {
        if (!_sent) revert EtherTransferFailed(msg.sender);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
