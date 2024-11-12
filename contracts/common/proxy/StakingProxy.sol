// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022
pragma solidity 0.8.17;
import "./transparent/TransparentUpgradeableProxy.sol";

contract StakingProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) payable TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
