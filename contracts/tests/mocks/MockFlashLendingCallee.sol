// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { IFlashLendingCallee } from "../../main/interfaces/IFlashLendingCallee.sol";

contract MockFlashLendingCallee is IFlashLendingCallee {
    function flashLendingCall(
        address _caller,
        uint256 _debtValueToRepay, // [rad]
        uint256 _collateralAmountToLiquidate, // [wad]
        bytes calldata
    ) external override {}

    function supportsInterface(bytes4) external view returns (bool) {}
}
