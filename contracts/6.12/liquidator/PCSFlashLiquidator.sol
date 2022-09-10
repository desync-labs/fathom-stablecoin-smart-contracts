// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "@alpaca-finance/alpaca-contract/contracts/6/protocol/apis/pancake/IPancakeRouter02.sol";

import "../interfaces/IFlashLendingCallee.sol";
import "../interfaces/IGenericTokenAdapter.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IFathomVault.sol";
import "../interfaces/IStableSwapModule.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../utils/SafeToken.sol";

contract PCSFlashLiquidator is IFlashLendingCallee {
    using SafeToken for address;
    // using SafeMathUpgradeable for uint256;

    struct LocalVars {
        address liquidatorAddress;
        IGenericTokenAdapter tokenAdapter;
        address vaultAddress;
        IPancakeRouter02 router;
        address[] path;
        address stableSwapModuleAddress;
    }

    event LogFlashLiquidation(
        address indexed liquidatorAddress,
        uint256 debtValueToRepay,
        uint256 collateralAmountToLiquidate,
        uint256 liquidationProfit
    );
    event LogSellCollateral(uint256 amount, uint256 minAmountOut, uint256 actualAmountOut);
    event LogSwapTokenToStablecoin(uint256 amount, address usr, uint256 receivedAmount);
    event LogSetBUSDAddress(address indexed caller, address busd);
    event LogSetWrappedNativeAddress(address indexed caller, address wrappedNativeAddr);

    // --- Math ---
    uint256 constant WAD = 10**18;
    uint256 constant RAY = 10**27;
    uint256 constant RAD = 10**45;

    IBookKeeper public bookKeeper;
    IStablecoinAdapter public stablecoinAdapter;
    address public fathomStablecoin;
    address public wrappedNativeAddr;
    address public busd;

    constructor(
        address _bookKeeper,
        address _fathomStablecoin,
        address _stablecoinAdapter,
        address _wrappedNativeAddr,
        address _busd
    ) public {
        bookKeeper = IBookKeeper(_bookKeeper);
        fathomStablecoin = _fathomStablecoin;
        stablecoinAdapter = IStablecoinAdapter(_stablecoinAdapter);
        wrappedNativeAddr = _wrappedNativeAddr;
        busd = _busd;
    }

    function setWrappedNativeAddress(address _wrappedNativeAddr) external    {
        wrappedNativeAddr = _wrappedNativeAddr;
        emit LogSetWrappedNativeAddress(msg.sender, _wrappedNativeAddr);
    }

    function setBUSDAddress(address _busd) external    {
        busd = _busd;
        emit LogSetBUSDAddress(msg.sender, _busd);
    }

    function flashLendingCall(
        address _caller,
        uint256 _debtValueToRepay, // [rad]
        uint256 _collateralAmountToLiquidate, // [wad]
        bytes calldata data
    ) external override {
        LocalVars memory _vars;
        (
            _vars.liquidatorAddress,
            _vars.tokenAdapter,
            _vars.vaultAddress,
            _vars.router,
            _vars.path,
            _vars.stableSwapModuleAddress
        ) = abi.decode(data, (address, IGenericTokenAdapter, address, IPancakeRouter02, address[], address));

        // Retrieve collateral token
        (address _token, uint256 _actualCollateralAmount) = _retrieveCollateral(
            _vars.tokenAdapter,
            _vars.vaultAddress,
            _collateralAmountToLiquidate
        );

        // Swap token to AUSD
        require(
            _debtValueToRepay / (RAY) + 1 <=
                _sellCollateral(
                    _token,
                    _vars.path,
                    _vars.router,
                    _actualCollateralAmount,
                    _debtValueToRepay,
                    _vars.stableSwapModuleAddress
                ),
            "not enough to repay debt"
        );

        // Deposit Fathom Stablecoin for liquidatorAddress
        uint256 _liquidationProfit = _depositFathomStablecoin(_debtValueToRepay / (RAY) + 1, _vars.liquidatorAddress);
        emit LogFlashLiquidation(
            _vars.liquidatorAddress,
            _debtValueToRepay,
            _collateralAmountToLiquidate,
            _liquidationProfit
        );
    }

    function _retrieveCollateral(
        IGenericTokenAdapter _tokenAdapter,
        address _vaultAddress,
        uint256 _amount
    ) internal returns (address _token, uint256 _actualAmount) {
        bookKeeper.whitelist(address(_tokenAdapter));
        _tokenAdapter.withdraw(address(this), _amount, abi.encode(address(this)));
        _token = _tokenAdapter.collateralToken();
        _actualAmount = _amount;
        if (_vaultAddress != address(0)) {
            _token = IFathomVault(_vaultAddress).token();
            if (_token == wrappedNativeAddr) {
                uint256 vaultBaseTokenBalanceBefore = address(this).balance;
                IFathomVault(_vaultAddress).withdraw(_amount);
                uint256 vaultBaseTokenBalanceAfter = address(this).balance;
                _actualAmount = vaultBaseTokenBalanceAfter - (vaultBaseTokenBalanceBefore);
            } else {
                uint256 vaultBaseTokenBalanceBefore = IFathomVault(_vaultAddress).token().myBalance();
                IFathomVault(_vaultAddress).withdraw(_amount);
                uint256 vaultBaseTokenBalanceAfter = IFathomVault(_vaultAddress).token().myBalance();
                _actualAmount = vaultBaseTokenBalanceAfter - (vaultBaseTokenBalanceBefore);
            }
        }
    }

    function _sellCollateral(
        address _token,
        address[] memory _path,
        IPancakeRouter02 _router,
        uint256 _amount,
        uint256 _minAmountOut,
        address _stableSwapModuleAddress
    ) internal returns (uint256 receivedAmount) {
        if (_path.length != 0) {
            address _tokencoinAddress = _path[_path.length - 1];
            uint256 _tokencoinBalanceBefore = _tokencoinAddress.myBalance();

            if (_token != busd) {
                if (_token == wrappedNativeAddr) {
                    _router.swapExactETHForTokens{ value: _amount }(_minAmountOut / (RAY) + 1, _path, address(this), now);
                } else {
                    _token.safeApprove(address(_router), uint256(-1));
                    _router.swapExactTokensForTokens(_amount, _minAmountOut / (RAY) + 1, _path, address(this), now);
                    _token.safeApprove(address(_router), 0);
                }
            }
            uint256 _tokencoinBalanceAfter = _tokencoinAddress.myBalance();
            uint256 _tokenAmount = _token != busd ? _tokencoinBalanceAfter - (_tokencoinBalanceBefore) : _amount;
            receivedAmount = _swapTokenToStablecoin(_stableSwapModuleAddress, address(this), _tokenAmount, _tokencoinAddress);
            emit LogSellCollateral(_amount, _minAmountOut, receivedAmount);
        }
    }

    function _swapTokenToStablecoin(
        address _stableSwapModuleAddress,
        address _usr,
        uint256 _amount,
        address _tokencoinAddress
    ) internal returns (uint256 receivedAmount) {
        uint256 _fathomStablecoinBalanceBefore = fathomStablecoin.myBalance();
        IStableSwapModule stableSwapModule = IStableSwapModule(_stableSwapModuleAddress);
        address authTokenApdapter = address(stableSwapModule.authTokenAdapter());
        _tokencoinAddress.safeApprove(authTokenApdapter, uint256(-1));
        stableSwapModule.swapTokenToStablecoin(_usr, _amount);
        _tokencoinAddress.safeApprove(authTokenApdapter, 0);
        uint256 _fathomStablecoinBalanceAfter = fathomStablecoin.myBalance();
        receivedAmount = _fathomStablecoinBalanceAfter - (_fathomStablecoinBalanceBefore);

        emit LogSwapTokenToStablecoin(_amount, _usr, receivedAmount);
    }

    function _depositFathomStablecoin(uint256 _amount, address _liquidatorAddress)
        internal
        returns (uint256 _liquidationProfit)
    {
        uint256 balanceBefore = fathomStablecoin.myBalance();
        fathomStablecoin.safeApprove(address(stablecoinAdapter), uint256(-1));
        stablecoinAdapter.deposit(_liquidatorAddress, _amount, abi.encode(0));
        fathomStablecoin.safeApprove(address(stablecoinAdapter), 0);
        _liquidationProfit = balanceBefore - (_amount);
    }

    function whitelist(address _toBeWhitelistedAddress) external    {
        bookKeeper.whitelist(_toBeWhitelistedAddress);
    }

    function withdrawToken(address _token, uint256 _amount) external    {
        _token.safeTransfer(msg.sender, _amount);
    }

    fallback() external payable {}

    receive() external payable {}
}
