// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IWXDC.sol";
import "../interfaces/IToken.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/IFarmableTokenAdapter.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IStabilityFeeCollector.sol";
import "../interfaces/IProxyRegistry.sol";
import "../interfaces/IProxy.sol";
import "../utils/SafeToken.sol";

/// @notice WARNING: These functions meant to be used as a a library for a Proxy.
/// @notice DO NOT CALL ANY FUNCTION IN THIS CONTRACT DIRECTLY.
/// @notice Hence, it shouldn't has any state vairables. Some are unsafe if you call them directly.
contract FathomStablecoinProxyActions {
    using SafeToken for address;
    uint256 internal constant RAY = 10 ** 27;

    function _safeSub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x, "sub-overflow");
    }

    function _safeToInt(uint256 _x) internal pure returns (int256 _y) {
        _y = int256(_x);
        require(_y >= 0, "int-overflow");
    }

    function _safeMul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x, "mul-overflow");
    }

    function _toRad(uint256 _wad) internal pure returns (uint256 _rad) {
        _rad = _safeMul(_wad, RAY);
    }

    function convertTo18(address _tokenAdapter, uint256 _amt) internal returns (uint256 _wad) {
        // For those collaterals that have less than 18 decimals precision we need to do the conversion before passing to adjustPosition function
        // Adapters will automatically handle the difference of precision
        _wad = _safeMul(_amt, 10 ** (18 - IGenericTokenAdapter(_tokenAdapter).decimals()));
    }

    function _getDrawDebtShare(
        address _bookKeeper,
        address _stabilityFeeCollector,
        address _positionAddress,
        bytes32 _collateralPoolId,
        uint256 _stablecoinAmount // [wad]
    ) internal returns (int256 _resultDebtShare) {
        uint256 _debtAccumulatedRate = IStabilityFeeCollector(_stabilityFeeCollector).collect(_collateralPoolId); // [ray]. Updates stability fee rate
        uint256 _positionStablecoinValue = IBookKeeper(_bookKeeper).stablecoin(_positionAddress); // [rad]. Gets Fathom Stablecoin balance of the positionAddress in the bookKeeper

        // If there was already enough Fathom Stablecoin in the bookKeeper balance, just exits it without adding more debt
        if (_positionStablecoinValue < _safeMul(_stablecoinAmount, RAY)) {
            // Calculates the needed resultDebtShare so together with the existing positionStablecoinValue in the bookKeeper is enough to exit stablecoinAmount of Fathom Stablecoin tokens
            _resultDebtShare = _safeToInt(_safeSub(_safeMul(_stablecoinAmount, RAY), _positionStablecoinValue) / _debtAccumulatedRate);
            // This is neeeded due lack of precision. It might need to sum an extra resultDebtShare wei (for the given Fathom Stablecoin stablecoinAmount)
            _resultDebtShare = _safeMul(uint256(_resultDebtShare), _debtAccumulatedRate) < _safeMul(_stablecoinAmount, RAY)
                ? _resultDebtShare + 1
                : _resultDebtShare;
        }
    }

    function _getWipeDebtShare(
        address _bookKeeper,
        uint256 _stablecoinValue, // [rad]
        address _positionAddress,
        bytes32 _collateralPoolId
    ) internal view returns (int256 _resultDebtShare) {
        uint256 _debtAccumulatedRate = ICollateralPoolConfig(IBookKeeper(_bookKeeper).collateralPoolConfig()).getDebtAccumulatedRate(
            _collateralPoolId
        ); // [ray]. // Gets actual rate from the bookKeeper
        (, uint256 _debtShare) = IBookKeeper(_bookKeeper).positions(_collateralPoolId, _positionAddress); // [wad]. // Gets actual debtShare value of the positionAddress

        _resultDebtShare = _safeToInt(_stablecoinValue / _debtAccumulatedRate); // [wad]. // Uses the whole stablecoin balance in the bookKeeper to reduce the debt
        _resultDebtShare = uint256(_resultDebtShare) <= _debtShare ? -_resultDebtShare : -_safeToInt(_debtShare); // [wad]. // Checks the calculated resultDebtShare is not higher than positionAddress.art (total debt), otherwise uses its value
    }

    function _getWipeAllStablecoinAmount(
        address _bookKeeper,
        address _usr,
        address _positionAddress,
        bytes32 _collateralPoolId
    ) internal view returns (uint256 _requiredStablecoinAmount) {
        uint256 _debtAccumulatedRate = ICollateralPoolConfig(IBookKeeper(_bookKeeper).collateralPoolConfig()).getDebtAccumulatedRate(
            _collateralPoolId
        ); // [ray]. Gets actual rate from the bookKeeper
        (, uint256 _debtShare) = IBookKeeper(_bookKeeper).positions(_collateralPoolId, _positionAddress); // [wad]. Gets actual debtShare value of the positionAddress
        uint256 _stablecoinValue = IBookKeeper(_bookKeeper).stablecoin(_usr); // [rad]. Gets actual stablecoin amount in the usr

        uint256 _positionDebtValue = _safeMul(_debtShare, _debtAccumulatedRate);
        uint256 _requiredStablecoinValue = _positionDebtValue >= _stablecoinValue ? _safeSub(_positionDebtValue, _stablecoinValue) : 0; // [rad]
        _requiredStablecoinAmount = _requiredStablecoinValue / RAY; // [wad] = [rad]/[ray]

        // If the value precision has some dust, it will need to request for 1 extra amount wei
        _requiredStablecoinAmount = _safeMul(_requiredStablecoinAmount, RAY) < _requiredStablecoinValue
            ? _requiredStablecoinAmount + 1
            : _requiredStablecoinAmount;
    }

    /// @param _adapter The address of stablecoin adapter
    /// @param _positionAddress The address of the Position Handler
    /// @param _stablecoinAmount The amount in wad to be deposit to Stablecoin adapter [wad]
    /// @param _data The extra data for stable adapter context
    function stablecoinAdapterDeposit(
        address _adapter,
        address _positionAddress,
        uint256 _stablecoinAmount, // [wad]
        bytes calldata _data
    ) public {
        address _stablecoin = address(IStablecoinAdapter(_adapter).stablecoin());
        // Gets Fathom Stablecoin from the user's wallet
        _stablecoin.safeTransferFrom(msg.sender, address(this), _stablecoinAmount);

        // Approves adapter to take the Fathom Stablecoin amount
        _stablecoin.safeApprove(_adapter, _stablecoinAmount);
        // Deposits Fathom Stablecoin into the bookKeeper
        IStablecoinAdapter(_adapter).deposit(_positionAddress, _stablecoinAmount, _data);
    }

    function transfer(address _collateralToken, address _dst, uint256 _amt) public {
        address(_collateralToken).safeTransfer(_dst, _amt);
    }

    function xdcAdapterDeposit(address _adapter, address _positionAddress, bytes calldata _data) public payable {
       IGenericTokenAdapter(_adapter).deposit{value: msg.value}(_positionAddress, msg.value, _data); //XDC collateral into the bookKeeper
    }

    function whitelist(address _bookKeeper, address _usr) external {
        IBookKeeper(_bookKeeper).whitelist(_usr);
    }

    function blacklist(address _bookKeeper, address _usr) external {
        IBookKeeper(_bookKeeper).blacklist(_usr);
    }

    function open(address _manager, bytes32 _collateralPoolId, address _usr) public returns (uint256 _positionId) {
        _positionId = IManager(_manager).open(_collateralPoolId, _usr);
    }

    function transferOwnership(address _manager, uint256 _positionId, address _usr) public {
        IManager(_manager).give(_positionId, _usr);
    }

    function transferOwnershipToProxy(address _proxyRegistry, address _manager, uint256 _positionId, address _dst) external {
        address _proxy = IProxyRegistry(_proxyRegistry).proxies(_dst);
        if (_proxy == address(0) || IProxy(_proxy).owner() != _dst) {
            uint256 _codeSize;
            assembly {
                _codeSize := extcodesize(_dst)
            }
            require(_codeSize == 0, "Dst-is-a-contract"); // We want to avoid creating a proxy for a contract address that might not be able to handle proxies, then losing the CDP
            _proxy = IProxyRegistry(_proxyRegistry).build(_dst); // Creates the proxy for the dst address
        }
        transferOwnership(_manager, _positionId, _proxy);
    }

    function allowManagePosition(address _manager, uint256 _positionId, address _user, uint256 _ok) external {
        IManager(_manager).allowManagePosition(_positionId, _user, _ok);
    }

    function allowMigratePosition(address _manager, address _user, uint256 _ok) external {
        IManager(_manager).allowMigratePosition(_user, _ok);
    }

    function moveCollateral(
        address _manager,
        uint256 _positionId,
        address _dst,
        uint256 _collateralAmount,
        address _adapter,
        bytes calldata _data
    ) public {
        IManager(_manager).moveCollateral(_positionId, _dst, _collateralAmount, _adapter, _data);
    }

    function moveStablecoin(
        address _manager,
        uint256 _positionId,
        address _dst,
        uint256 _stablecoinValue // [rad]
    ) public {
        IManager(_manager).moveStablecoin(_positionId, _dst, _stablecoinValue);
    }

    function adjustPosition(
        address _manager,
        uint256 _positionId,
        int256 _collateralValue,
        int256 _debtShare, // [wad]
        address _adapter,
        bytes calldata _data
    ) public {  
        IManager(_manager).adjustPosition(_positionId, _collateralValue, _debtShare, _adapter, _data);
    }

    function exportPosition(address _manager, uint256 _positionId, address _destination) external {
        IManager(_manager).exportPosition(_positionId, _destination);
    }

    function importPosition(address _manager, address _source, uint256 _positionId) external {
        IManager(_manager).importPosition(_source, _positionId);
    }

    function movePosition(address _manager, uint256 _source, uint256 _destination) external {
        IManager(_manager).movePosition(_source, _destination);
    }


    function lockXDC(address _manager, address _xdcAdapter, uint256 _positionId, bytes calldata _data) public payable {
        address _positionAddress = IManager(_manager).positions(_positionId);
        xdcAdapterDeposit(_xdcAdapter, _positionAddress, _data); // Receives XDC, stake it to Ankr staking pool.
        adjustPosition(_manager, _positionId, _safeToInt(msg.value), 0, _xdcAdapter, _data); // Locks XDC amount into the CDP
    }

    function safeLockXDC(address _manager, address _xdcAdapter, uint256 _positionId, address _owner, bytes calldata _data) external payable {
        require(IManager(_manager).owners(_positionId) == _owner, "!owner");
        lockXDC(_manager, _xdcAdapter, _positionId, _data);
    }

    function draw(
        address _manager,
        address _stabilityFeeCollector,
        address _tokenAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _amount, // [wad]
        bytes calldata _data
    ) external {
        address _positionAddress = IManager(_manager).positions(_positionId);
        address _bookKeeper = IManager(_manager).bookKeeper();
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);
        // Generates debt in the CDP
        adjustPosition(
            _manager,
            _positionId,
            0,
            _getDrawDebtShare(_bookKeeper, _stabilityFeeCollector, _positionAddress, _collateralPoolId, _amount),
            _tokenAdapter,
            _data
        );

        moveStablecoin(_manager, _positionId, address(this), _toRad(_amount)); // Moves the Fathom Stablecoin amount (balance in the bookKeeper in rad) to proxy's address

        // Allows adapter to access to proxy's Fathom Stablecoin balance in the bookKeeper
        if (IBookKeeper(_bookKeeper).positionWhitelist(address(this), address(_stablecoinAdapter)) == 0) {
            IBookKeeper(_bookKeeper).whitelist(_stablecoinAdapter);
        }

        IStablecoinAdapter(_stablecoinAdapter).withdraw(msg.sender, _amount, _data); // Withdraws Fathom Stablecoin to the user's wallet as a token
        IManager(_manager).updatePrice(_collateralPoolId);
    }

    function wipe(
        address _manager,
        address _tokenAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _amount, // [wad]
        bytes calldata _data
    ) public {
        address _bookKeeper = IManager(_manager).bookKeeper();
        address _positionAddress = IManager(_manager).positions(_positionId);
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);

        address owner = IManager(_manager).owners(_positionId);
        if (owner == address(this) || IManager(_manager).ownerWhitelist(owner, _positionId, address(this)) == 1) {
            stablecoinAdapterDeposit(_stablecoinAdapter, _positionAddress, _amount, _data); // Deposits Fathom Stablecoin amount into the bookKeeper
            // Paybacks debt to the CDP
            adjustPosition(
                _manager,
                _positionId,
                0,
                _getWipeDebtShare(_bookKeeper, IBookKeeper(_bookKeeper).stablecoin(_positionAddress), _positionAddress, _collateralPoolId),
                _tokenAdapter,
                _data
            );
        } else {
            stablecoinAdapterDeposit(_stablecoinAdapter, address(this), _amount, _data); // Deposits Fathom Stablecoin amount into the bookKeeper
            int256 _wipeDebtShare = _getWipeDebtShare(_bookKeeper, _amount * RAY, _positionAddress, _collateralPoolId); // Paybacks debt to the position
            IBookKeeper(_bookKeeper).adjustPosition(_collateralPoolId, _positionAddress, address(this), address(this), 0, _wipeDebtShare);
        }
        IManager(_manager).updatePrice(_collateralPoolId);
    }

    function safeWipe(
        address _manager,
        address _tokenAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _amount, // [wad]
        address _owner,
        bytes calldata _data
    ) external {
        require(IManager(_manager).owners(_positionId) == _owner, "!owner");
        wipe(_manager, _tokenAdapter, _stablecoinAdapter, _positionId, _amount, _data);
    }

    function wipeAll(address _manager, address _tokenAdapter, address _stablecoinAdapter, uint256 _positionId, bytes calldata _data) public {
        address _bookKeeper = IManager(_manager).bookKeeper();
        address _positionAddress = IManager(_manager).positions(_positionId);
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);
        (, uint256 _debtShare) = IBookKeeper(_bookKeeper).positions(_collateralPoolId, _positionAddress); // [wad]

        address _owner = IManager(_manager).owners(_positionId);
        if (_owner == address(this) || IManager(_manager).ownerWhitelist(_owner, _positionId, address(this)) == 1) {
            // Deposits Fathom Stablecoin amount into the bookKeeper
            stablecoinAdapterDeposit(
                _stablecoinAdapter,
                _positionAddress,
                _getWipeAllStablecoinAmount(_bookKeeper, _positionAddress, _positionAddress, _collateralPoolId),
                _data
            );
            adjustPosition(_manager, _positionId, 0, -int256(_debtShare), _tokenAdapter, _data); // Paybacks debt to the CDP
        } else {
            // Deposits Fathom Stablecoin amount into the bookKeeper
            stablecoinAdapterDeposit(
                _stablecoinAdapter,
                address(this),
                _getWipeAllStablecoinAmount(_bookKeeper, address(this), _positionAddress, _collateralPoolId),
                _data
            );
            IBookKeeper(_bookKeeper).adjustPosition(_collateralPoolId, _positionAddress, address(this), address(this), 0, -int256(_debtShare)); // Paybacks debt to the position
        }
        IManager(_manager).updatePrice(_collateralPoolId);
    }

    function safeWipeAll(
        address _manager,
        address _tokenAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        address _owner,
        bytes calldata _data
    ) external {
        require(IManager(_manager).owners(_positionId) == _owner, "!owner");
        wipeAll(_manager, _tokenAdapter, _stablecoinAdapter, _positionId, _data);
    }

    function lockXDCAndDraw(
        address _manager,
        address _stabilityFeeCollector,
        address _xdcAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _stablecoinAmount, // [wad]
        bytes calldata _data
    ) public payable {
        address _positionAddress = IManager(_manager).positions(_positionId);
        address _bookKeeper = IManager(_manager).bookKeeper();
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);

        // deposits XDC to AnkrStakingPool via AnkrCollateralAdapter
        xdcAdapterDeposit(_xdcAdapter, _positionAddress, _data);

        adjustPosition(
        _manager,
        _positionId,
        _safeToInt(msg.value),
        _getDrawDebtShare(_bookKeeper, _stabilityFeeCollector, _positionAddress, _collateralPoolId, _stablecoinAmount),
        _xdcAdapter,
        _data
        );
        // Moves the Fathom Stablecoin amount (balance in the bookKeeper in rad) to proxy's address
        moveStablecoin(_manager, _positionId, address(this), _toRad(_stablecoinAmount));
        // Allows adapter to access to proxy's Fathom Stablecoin balance in the bookKeeper
        if (IBookKeeper(_bookKeeper).positionWhitelist(address(this), address(_stablecoinAdapter)) == 0) {
        IBookKeeper(_bookKeeper).whitelist(_stablecoinAdapter);
        }
        // Withdraws Fathom Stablecoin to the user's wallet as a token
        IStablecoinAdapter(_stablecoinAdapter).withdraw(msg.sender, _stablecoinAmount, _data);
        IManager(_manager).updatePrice(_collateralPoolId);
    }

    function openLockXDCAndDraw(
        address _manager,
        address _stabilityFeeCollector,
        address _xdcAdapter,
        address _stablecoinAdapter,
        bytes32 _collateralPoolId,
        uint256 _stablecoinAmount, // [wad]
        bytes calldata _data
    ) external payable returns (uint256 _positionId) {
        _positionId = open(_manager, _collateralPoolId, address(this));
        lockXDCAndDraw(_manager, _stabilityFeeCollector, _xdcAdapter, _stablecoinAdapter, _positionId, _stablecoinAmount, _data);
    }

    function wipeAndUnlockXDC(
        address _manager,
        address _xdcAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _collateralAmount, // [wad]
        uint256 _stablecoinAmount, // [wad]
        bytes calldata _data
    ) external {
        address _positionAddress = IManager(_manager).positions(_positionId);
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);
        stablecoinAdapterDeposit(_stablecoinAdapter, _positionAddress, _stablecoinAmount, _data); // Deposits Fathom Stablecoin amount into the bookKeeper
        // Paybacks debt to the position and unlocks WXDC amount from it
        int256 _wipeDebtShare = _getWipeDebtShare(
            IManager(_manager).bookKeeper(),
            IBookKeeper(IManager(_manager).bookKeeper()).stablecoin(_positionAddress),
            _positionAddress,
            _collateralPoolId
        ); // [wad]
        adjustPosition(_manager, _positionId, -_safeToInt(_collateralAmount), _wipeDebtShare, _xdcAdapter, _data);
        moveCollateral(_manager, _positionId, address(this), _collateralAmount, _xdcAdapter, _data); // Moves the amount from the position to proxy's address
        IGenericTokenAdapter(_xdcAdapter).withdraw(msg.sender, _collateralAmount, _data);
        IManager(_manager).updatePrice(_collateralPoolId);
    }

    function wipeAllAndUnlockXDC(
        address _manager,
        address _xdcAdapter,
        address _stablecoinAdapter,
        uint256 _positionId,
        uint256 _collateralAmount, // [wad]
        bytes calldata _data
    ) external {
        address _bookKeeper = IManager(_manager).bookKeeper();
        address _positionAddress = IManager(_manager).positions(_positionId);
        bytes32 _collateralPoolId = IManager(_manager).collateralPools(_positionId);
        (, uint256 _debtShare) = IBookKeeper(_bookKeeper).positions(_collateralPoolId, _positionAddress); // [wad]

        // Deposits Fathom Stablecoin amount into the bookKeeper
        stablecoinAdapterDeposit(
            _stablecoinAdapter,
            _positionAddress,
            _getWipeAllStablecoinAmount(_bookKeeper, _positionAddress, _positionAddress, _collateralPoolId),
            _data
        );

        adjustPosition(_manager, _positionId, -_safeToInt(_collateralAmount), -int256(_debtShare), _xdcAdapter, _data); // Paybacks debt to the CDP and unlocks WXDC amount from it
        moveCollateral(_manager, _positionId, address(this), _collateralAmount, _xdcAdapter, _data); // Moves the amount from the CDP positionAddress to proxy's address
        IGenericTokenAdapter(_xdcAdapter).withdraw(msg.sender, _collateralAmount, _data); // Withdraw aXDCc from AnkrCollateralAdapter, fee deducted amount

        IManager(_manager).updatePrice(_collateralPoolId);
    }

}
