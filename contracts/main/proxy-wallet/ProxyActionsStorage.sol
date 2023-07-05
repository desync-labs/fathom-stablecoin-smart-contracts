// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IBookKeeper.sol";
import "../interfaces/IPausable.sol";

contract ProxyActionsStorage is PausableUpgradeable, IPausable {
    address public proxyAction;
    address public bookKeeper;

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    function initialize(address _proxyAction, address _bookKeeper) external initializer {
        require(_proxyAction != address(0) && _bookKeeper != address(0), "ProxyActionsStorage/zero-address");
        PausableUpgradeable.__Pausable_init();

        proxyAction = _proxyAction;
        bookKeeper = _bookKeeper;
    }

    function setProxyAction(address _proxyAction) external onlyOwner {
        proxyAction = _proxyAction;
    }

    // --- pause ---
    /// @dev access: OWNER_ROLE, GOV_ROLE
    function pause() external override onlyOwnerOrGov {
        _pause();
    }

    /// @dev access: OWNER_ROLE, GOV_ROLE
    function unpause() external override onlyOwnerOrGov {
        _unpause();
    }
}
