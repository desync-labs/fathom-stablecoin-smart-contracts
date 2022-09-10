// SPDX-License-Identifier: AGPL-3.0-or-later
// Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022

pragma solidity 0.6.12;

import "../interfaces/IGenericTokenAdapter.sol";

interface IFarmableTokenAdapter is IGenericTokenAdapter {
    function moveStake(
        address,
        address,
        uint256,
        bytes calldata
    ) external;
}
