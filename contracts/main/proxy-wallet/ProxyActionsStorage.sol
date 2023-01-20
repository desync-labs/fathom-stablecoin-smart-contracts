// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProxyActionsStorage is OwnableUpgradeable {
    address public proxyAction;

    function initialize(address _proxyAction) external initializer {
        OwnableUpgradeable.__Ownable_init();

        proxyAction = _proxyAction;
    }

    function setProxyAction(address _proxyAction) external onlyOwner {
        proxyAction = _proxyAction;
    }
}
