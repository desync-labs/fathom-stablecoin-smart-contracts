// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "./FathomProxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FathomProxyFactory is Ownable {
    mapping(bytes32 => address) public proxies;

    function createProxy(
        bytes32 proxyId,
        address impl,
        address proxyAdmin,
        bytes memory data
    ) external onlyOwner {
        FathomProxy proxy = new FathomProxy(impl, proxyAdmin, data);
        proxies[proxyId] = address(proxy);
    }
}
