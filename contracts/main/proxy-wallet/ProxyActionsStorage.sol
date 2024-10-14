// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IBookKeeper } from "../interfaces/IBookKeeper.sol";
import { IAccessControlConfig } from "../interfaces/IAccessControlConfig.sol";
contract ProxyActionsStorage is Initializable {
    address public proxyAction;
    IBookKeeper public bookKeeper;

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _proxyAction, address _bookKeeper) external initializer {
        require(_proxyAction != address(0) && _bookKeeper != address(0), "ProxyActionsStorage/zero-address");

        proxyAction = _proxyAction;
        bookKeeper = IBookKeeper(_bookKeeper);
    }

    function setProxyAction(address _proxyAction) external onlyOwner {
        proxyAction = _proxyAction;
    }
}
