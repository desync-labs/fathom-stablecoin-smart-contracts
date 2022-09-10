// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IFlashLendingCallee.sol";

contract MockFlashLendingCallee is IFlashLendingCallee {
    function flashLendingCall(
        address caller,
        uint256 debtValueToRepay, // [rad]
        uint256 collateralAmountToLiquidate, // [wad]
        bytes calldata
    ) external override {}
}
