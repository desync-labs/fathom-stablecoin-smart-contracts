// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/IPausable.sol";
import "./ProxyWallet.sol";
import "./ProxyWalletFactory.sol";

/// @dev This Registry deploys new proxy instances through ProxyWalletFactory.build(address) and keeps a registry of owner => proxy
contract ProxyWalletRegistry is PausableUpgradeable, IPausable {
    mapping(address => ProxyWallet) public proxies;
    ProxyWalletFactory internal factory;
    mapping(address => bool) public whitelisted;
    IBookKeeper public bookKeeper;
    bool public isDecentralizedMode;

    event LogAddToWhitelist(address indexed user);
    event LogRemoveFromWhitelist(address indexed user);
    event LogSetDecentralizedMode(bool newValue);
    event LogProxyWalletCreation(address owner, address proxyWallet);

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

    function initialize(address _factory, address _bookKeeper) external initializer {
        PausableUpgradeable.__Pausable_init();

        require(_factory != address(0), "ProxyWalletRegistry/zero-factory");
        require(_bookKeeper != address(0), "ProxyWalletRegistry/zero-bookKeeper");

        factory = ProxyWalletFactory(_factory);
        bookKeeper = IBookKeeper(_bookKeeper);
    }

    function addToWhitelist(address _usr) external onlyOwner {
        whitelisted[_usr] = true;
        emit LogAddToWhitelist(_usr);
    }

    function removeFromWhitelist(address _usr) external onlyOwner {
        whitelisted[_usr] = false;
        emit LogRemoveFromWhitelist(_usr);
    }

    function setDecentralizedMode(bool isOn) external onlyOwner {
        isDecentralizedMode = isOn;
        emit LogSetDecentralizedMode(isOn);
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

    /// @dev Deploys a new proxy instance and sets owner of proxy to caller
    function build0() external returns (address payable _proxy) {
        _proxy = build(msg.sender);
    }

    function setOwner(address _newOwner) external whenNotPaused {
        require(proxies[_newOwner] == ProxyWallet(payable(address(0))));
        ProxyWallet _proxy = proxies[msg.sender];
        require(_proxy.owner() == _newOwner);
        proxies[_newOwner] = _proxy;
        proxies[msg.sender] = ProxyWallet(payable(address(0)));
    }

    /// @dev Deploys a new proxy instance and sets custom owner of proxy
    function build(address _owner) public whenNotPaused returns (address payable _proxy) {
        require(whitelisted[_owner] || isDecentralizedMode, "ProxyWalletRegistry/user-is-not-whitelisted");
        require(proxies[_owner] == ProxyWallet(payable(address(0)))); // Not allow new proxy if the user already has one
        _proxy = factory.build(_owner);
        proxies[_owner] = ProxyWallet(_proxy);
        emit LogProxyWalletCreation(_owner, _proxy);
    }
}
