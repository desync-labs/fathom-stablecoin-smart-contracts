// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IGenericTokenAdapter.sol";

interface IFarmableTokenAdapter is IGenericTokenAdapter {
    function moveStake(address, address, uint256, bytes calldata) external;
}
