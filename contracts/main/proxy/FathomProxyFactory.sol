// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import { FathomProxy } from "./FathomProxy.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract FathomProxyFactory is Ownable {
    mapping(bytes32 => address) public proxies;

    function createProxy(bytes32 _proxyId, address _impl, address _proxyAdmin, bytes memory _data) external onlyOwner {
        require(proxies[_proxyId] == address(0), "Proxy already exists");
        FathomProxy proxy = new FathomProxy(_impl, _proxyAdmin, _data);
        proxies[_proxyId] = address(proxy);
    }
}
