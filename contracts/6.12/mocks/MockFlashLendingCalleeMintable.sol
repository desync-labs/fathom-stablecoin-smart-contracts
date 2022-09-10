// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IFlashLendingCallee.sol";
import "../interfaces/IBookKeeper.sol";

import "hardhat/console.sol";

contract MockFlashLendingCalleeMintable is IFlashLendingCallee {
    IBookKeeper public bookKeeper;

    // --- Init ---
    constructor(address _bookKeeper) public {
        

        bookKeeper = IBookKeeper(_bookKeeper);
    }

    function flashLendingCall(
        address caller,
        uint256 debtValueToRepay, // [rad]
        uint256 collateralAmountToLiquidate, // [wad]
        bytes calldata data
    ) external override {
        bookKeeper.mintUnbackedStablecoin(address(this), address(this), debtValueToRepay);
        if (data.length > 0) {
            (address treasuryAccount, bytes32 collateralPoolId) = abi.decode(data, (address, bytes32));
            bookKeeper.moveCollateral(collateralPoolId, address(this), treasuryAccount, collateralAmountToLiquidate);
        }
    }
}
