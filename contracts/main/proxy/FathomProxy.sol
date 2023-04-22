// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract FathomProxy is TransparentUpgradeableProxy {
    constructor(address logic, address admin_, bytes memory data) TransparentUpgradeableProxy(logic, admin_, data) {}
}
