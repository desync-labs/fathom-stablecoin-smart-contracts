// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ICollateralTokenAdapter {
    function grantRole(bytes32 role, address account) external;

    function PRICE_ORACLE_ROLE() external;
}
