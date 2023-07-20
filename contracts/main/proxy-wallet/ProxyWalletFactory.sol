// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./ProxyWallet.sol";

/// @dev This factory deploys new proxy instances through build(). Deployed proxy addresses are logged
contract ProxyWalletFactory is OwnableUpgradeable {
    mapping(address => bool) public isProxy;
    address public proxyActionStorage;
    address public proxyWalletRegistry;

    event LogCreated(address indexed _sender, address indexed _owner, address _proxy);

    modifier onlyRegistry() {
        require(msg.sender == proxyWalletRegistry, "!proxyWalletRegistry");
        _;
    }

    function initialize(address _proxyActionStorage, address _proxyWalletRegistry) external initializer {
        OwnableUpgradeable.__Ownable_init();

        require(_proxyActionStorage != address(0), "ProxyWalletFactory/zero-storage");
        require(_proxyWalletRegistry != address(0), "ProxyWalletFactory/zero-Registry");

        proxyActionStorage = _proxyActionStorage;
        proxyWalletRegistry = _proxyWalletRegistry;
    }

    /// @dev Deploys a new proxy instance and sets custom owner of proxy
    function build(address _owner) public onlyRegistry returns (address payable _proxy) {
        _proxy = payable(address(new ProxyWallet(proxyActionStorage)));
        emit LogCreated(msg.sender, _owner, address(_proxy));
        ProxyWallet(_proxy).setOwner(_owner);
        isProxy[_proxy] = true;
    }
}
