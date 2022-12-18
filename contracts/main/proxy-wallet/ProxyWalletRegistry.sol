// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./ProxyWallet.sol";
import "./ProxyWalletFactory.sol";

/// @dev This Registry deploys new proxy instances through ProxyWalletFactory.build(address) and keeps a registry of owner => proxy
contract ProxyWalletRegistry is OwnableUpgradeable {
    mapping(address => ProxyWallet) public proxies;
    ProxyWalletFactory factory;

    function initialize(address _factory) external initializer {
        OwnableUpgradeable.__Ownable_init();

        factory = ProxyWalletFactory(_factory);
    }

    /// @dev Deploys a new proxy instance and sets owner of proxy to caller
    function build0() external returns (address payable _proxy) {
        _proxy = build(msg.sender);
    }

    /// @dev Deploys a new proxy instance and sets custom owner of proxy
    function build(address owner) public returns (address payable _proxy) {
        require(proxies[owner] == ProxyWallet(payable(address(0)))); // Not allow new proxy if the user already has one
        _proxy = factory.build(owner);
        proxies[owner] = ProxyWallet(_proxy);
    }

    function setOwner(address _newOwner) external {
        require(proxies[_newOwner] == ProxyWallet(payable(address(0))));
        ProxyWallet _proxy = proxies[msg.sender];
        require(_proxy.owner() == _newOwner);
        proxies[_newOwner] = _proxy;
        proxies[msg.sender] = ProxyWallet(payable(address(0)));
    }
}
